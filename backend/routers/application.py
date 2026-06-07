"""
Application Router — Multi-stage hostel application pipeline.

Stage 1: Profile & Academic Eligibility verification
Stage 2: Special Accommodations gate (optional medical doc upload)
Stage 3: Hostel Preference selection (2 ranked choices)
Stage 4: Submit & Lock (transitions to pending_verification or ready_for_allocation)

Students cannot reach the allocation engine until all stages are cleared.
"""
import os
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional

from database import get_cursor
from dependencies import get_current_student
from config import UPLOAD_DIR
from services.audit_logger import log_event, APPLICATION_SUBMITTED, APPLICATION_STAGE_ADVANCED, MEDICAL_DOC_UPLOADED
from services.email import send_application_submitted_email

router = APIRouter(prefix="/api/v1/application", tags=["application"])

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
MAX_UPLOAD_ATTEMPTS = 3
UPLOAD_BASE = UPLOAD_DIR


class ApplicationStage3Body(BaseModel):
    choice_1_id: int
    choice_2_id: int


def _get_active_session(cur):
    cur.execute(
        """SELECT id, session_name, application_portal_open
           FROM academic_sessions WHERE is_active = TRUE LIMIT 1"""
    )
    return cur.fetchone()


def _get_or_create_draft(cur, student_id, session_id):
    """Get existing application or create a draft."""
    cur.execute(
        "SELECT id, status, stage_completed, has_special_needs, upload_attempt FROM hostel_applications WHERE student_id = %s AND session_id = %s",
        (student_id, session_id),
    )
    row = cur.fetchone()
    if row:
        return {"id": row[0], "status": row[1], "stage_completed": row[2], "has_special_needs": row[3], "upload_attempt": row[4]}
    # Create a new draft
    cur.execute(
        """INSERT INTO hostel_applications (student_id, session_id, status, stage_completed)
           VALUES (%s, %s, 'draft', 0) RETURNING id""",
        (student_id, session_id),
    )
    app_id = cur.fetchone()[0]
    return {"id": app_id, "status": "draft", "stage_completed": 0, "has_special_needs": False, "upload_attempt": 0}


# ── Stage 1: Academic Eligibility ────────────────────────────────────────────

@router.post("/stage1")
def submit_stage1(student=Depends(get_current_student)):
    """Stage 1: Verify academic eligibility from session register."""
    with get_cursor() as cur:
        session = _get_active_session(cur)
        if not session:
            raise HTTPException(status_code=404, detail="No active session")
        if not session[2]:
            raise HTTPException(status_code=403, detail="Application portal is currently closed")

        session_id = session[0]

        # Check student is in the session register
        cur.execute(
            "SELECT id, surname, first_name, gender, department, level, study_type FROM session_register WHERE session_id = %s AND matric_number = %s",
            (session_id, student["identifier"]),
        )
        reg = cur.fetchone()
        if not reg:
            raise HTTPException(
                status_code=403,
                detail="Your matric number is not in the current session register. Contact admin.",
            )

        app = _get_or_create_draft(cur, student["user_id"], session_id)

        # Don't allow re-doing stage 1 if already submitted
        if app["status"] not in ("draft",):
            if app["status"] == "medical_rejected" and app["stage_completed"] >= 1:
                pass  # Allow re-entry for rejected students
            elif app["stage_completed"] >= 1:
                return {
                    "message": "Stage 1 already completed",
                    "stage_completed": app["stage_completed"],
                    "application_id": app["id"],
                }

        # Update stage
        cur.execute(
            "UPDATE hostel_applications SET stage_completed = GREATEST(stage_completed, 1) WHERE id = %s",
            (app["id"],),
        )

    log_event(
        APPLICATION_STAGE_ADVANCED, "student", student["identifier"],
        "Completed Stage 1: Academic Eligibility",
        target_entity="hostel_application", target_id=str(app["id"]),
        metadata={"stage": 1},
        session_id=session_id,
    )

    return {
        "message": "Academic eligibility confirmed",
        "stage_completed": 1,
        "application_id": app["id"],
        "academic_data": {
            "matric_number": student["identifier"],
            "surname": reg[1],
            "first_name": reg[2],
            "gender": reg[3],
            "department": reg[4],
            "level": reg[5],
            "study_type": reg[6],
        },
    }


# ── Stage 2: Special Accommodations ──────────────────────────────────────────

@router.post("/stage2")
async def submit_stage2(
    has_special_needs: bool = Form(...),
    special_needs_type: Optional[str] = Form(None),
    medical_doc: Optional[UploadFile] = File(None),
    student=Depends(get_current_student),
):
    """Stage 2: Special accommodations gate with optional medical document upload."""
    with get_cursor() as cur:
        session = _get_active_session(cur)
        if not session:
            raise HTTPException(status_code=404, detail="No active session")
        if not session[2]:
            raise HTTPException(status_code=403, detail="Application portal is currently closed")

        session_id = session[0]

        cur.execute(
            "SELECT id, status, stage_completed, upload_attempt FROM hostel_applications WHERE student_id = %s AND session_id = %s",
            (student["user_id"], session_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=400, detail="Complete Stage 1 first")

        app_id, app_status, stage_completed, upload_attempt = row

        if stage_completed < 1:
            raise HTTPException(status_code=400, detail="Complete Stage 1 first")

        # Allow re-entry if rejected (for re-upload)
        if app_status not in ("draft", "medical_rejected") and stage_completed >= 2:
            return {"message": "Stage 2 already completed", "stage_completed": stage_completed, "application_id": app_id}

        medical_doc_path = None
        medical_doc_original_name = None
        new_attempt = upload_attempt or 0

        if has_special_needs:
            if not special_needs_type:
                raise HTTPException(status_code=400, detail="Please specify the type of special accommodation needed")

            if not medical_doc:
                raise HTTPException(status_code=400, detail="Medical documentation is required for special accommodation requests")

            # Check upload attempt limit
            if new_attempt >= MAX_UPLOAD_ATTEMPTS:
                raise HTTPException(
                    status_code=403,
                    detail=f"Maximum upload attempts ({MAX_UPLOAD_ATTEMPTS}) reached for this session. Contact Student Affairs.",
                )

            # Validate file type
            ext = os.path.splitext(medical_doc.filename)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(status_code=400, detail=f"Invalid file type '{ext}'. Allowed: PDF, JPEG, PNG")

            # Validate file size
            contents = await medical_doc.read()
            if len(contents) > MAX_FILE_SIZE:
                raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")

            # Store file
            upload_dir = os.path.join(UPLOAD_BASE, "medical", str(session_id))
            os.makedirs(upload_dir, exist_ok=True)

            safe_filename = f"{student['user_id']}_{uuid.uuid4().hex[:8]}{ext}"
            file_path = os.path.join(upload_dir, safe_filename)

            with open(file_path, "wb") as f:
                f.write(contents)

            medical_doc_path = file_path
            medical_doc_original_name = medical_doc.filename
            new_attempt += 1

            log_event(
                MEDICAL_DOC_UPLOADED, "student", student["identifier"],
                f"Uploaded medical document (attempt {new_attempt}/{MAX_UPLOAD_ATTEMPTS})",
                target_entity="hostel_application", target_id=str(app_id),
                metadata={"filename": medical_doc.filename, "attempt": new_attempt},
                session_id=session_id,
            )

        # Update application
        update_fields = [
            "has_special_needs = %s",
            "special_needs_type = %s",
            "stage_completed = GREATEST(stage_completed, 2)",
        ]
        params = [has_special_needs, special_needs_type if has_special_needs else None]

        if medical_doc_path:
            update_fields.extend([
                "medical_doc_path = %s",
                "medical_doc_original_name = %s",
                "upload_attempt = %s",
            ])
            params.extend([medical_doc_path, medical_doc_original_name, new_attempt])

        # If re-uploading after rejection, reset status to draft
        if app_status == "medical_rejected":
            update_fields.append("status = 'draft'")
            update_fields.append("medical_review_notes = NULL")

        params.append(app_id)
        cur.execute(
            f"UPDATE hostel_applications SET {', '.join(update_fields)} WHERE id = %s",
            params,
        )

    return {
        "message": "Special accommodations information saved",
        "stage_completed": 2,
        "application_id": app_id,
        "has_special_needs": has_special_needs,
        "upload_attempt": new_attempt,
        "max_attempts": MAX_UPLOAD_ATTEMPTS,
    }


# ── Stage 3: Hostel Preferences ──────────────────────────────────────────────

@router.post("/stage3")
def submit_stage3(data: ApplicationStage3Body, student=Depends(get_current_student)):
    """Stage 3: Select 2 ranked hostel preferences."""
    with get_cursor() as cur:
        session = _get_active_session(cur)
        if not session:
            raise HTTPException(status_code=404, detail="No active session")
        if not session[2]:
            raise HTTPException(status_code=403, detail="Application portal is currently closed")

        session_id = session[0]

        cur.execute(
            "SELECT id, status, stage_completed FROM hostel_applications WHERE student_id = %s AND session_id = %s",
            (student["user_id"], session_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=400, detail="Complete Stage 1 and 2 first")

        app_id, app_status, stage_completed = row

        if stage_completed < 2:
            raise HTTPException(status_code=400, detail="Complete Stage 2 first")

        if app_status not in ("draft", "medical_rejected"):
            if stage_completed >= 3 and app_status != "draft":
                return {"message": "Stage 3 already completed", "stage_completed": stage_completed, "application_id": app_id}

        # Validate choices are different
        if data.choice_1_id == data.choice_2_id:
            raise HTTPException(status_code=400, detail="Please select 2 different hostels")

        # Validate hostel choices exist and match gender
        gender = student["gender"]
        for choice_id, label in [(data.choice_1_id, "1st"), (data.choice_2_id, "2nd")]:
            cur.execute(
                "SELECT gender_restriction, status FROM hostels WHERE id = %s",
                (choice_id,),
            )
            hostel = cur.fetchone()
            if not hostel:
                raise HTTPException(status_code=400, detail=f"{label} choice hostel not found")
            if hostel[1] != "active":
                raise HTTPException(status_code=400, detail=f"{label} choice hostel is not active")
            if hostel[0] != "mixed" and hostel[0] != gender:
                raise HTTPException(status_code=400, detail=f"{label} choice hostel does not match your gender")

        # Update application with choices
        cur.execute(
            """UPDATE hostel_applications
               SET choice_1_id = %s, choice_2_id = %s, choice_3_id = NULL,
                   stage_completed = GREATEST(stage_completed, 3)
               WHERE id = %s""",
            (data.choice_1_id, data.choice_2_id, app_id),
        )

    log_event(
        APPLICATION_STAGE_ADVANCED, "student", student["identifier"],
        "Completed Stage 3: Hostel Preferences",
        target_entity="hostel_application", target_id=str(app_id),
        metadata={"choice_1": data.choice_1_id, "choice_2": data.choice_2_id},
        session_id=session_id,
    )

    return {"message": "Hostel preferences saved", "stage_completed": 3, "application_id": app_id}


# ── Stage 4: Submit & Lock ───────────────────────────────────────────────────

@router.post("/submit")
def submit_application(student=Depends(get_current_student)):
    """Final submission — locks the application into pending_verification or ready_for_allocation."""
    with get_cursor() as cur:
        session = _get_active_session(cur)
        if not session:
            raise HTTPException(status_code=404, detail="No active session")
        if not session[2]:
            raise HTTPException(status_code=403, detail="Application portal is currently closed")

        session_id = session[0]

        cur.execute(
            """SELECT id, status, stage_completed, has_special_needs
               FROM hostel_applications WHERE student_id = %s AND session_id = %s""",
            (student["user_id"], session_id),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=400, detail="No application found. Complete all stages first.")

        app_id, app_status, stage_completed, has_special_needs = row

        if stage_completed < 3:
            raise HTTPException(status_code=400, detail=f"Complete all 3 stages first (currently at stage {stage_completed})")

        if app_status not in ("draft",):
            raise HTTPException(status_code=409, detail=f"Application already submitted (status: {app_status})")

        # Determine target status
        if has_special_needs:
            new_status = "pending_verification"
        else:
            new_status = "ready_for_allocation"

        cur.execute(
            "UPDATE hostel_applications SET status = %s, stage_completed = 4, submitted_at = NOW() WHERE id = %s",
            (new_status, app_id),
        )

        # Get student email for notification
        cur.execute("SELECT email, first_name FROM users WHERE id = %s", (student["user_id"],))
        user_row = cur.fetchone()

    log_event(
        APPLICATION_SUBMITTED, "student", student["identifier"],
        f"Submitted hostel application → {new_status}",
        target_entity="hostel_application", target_id=str(app_id),
        metadata={"has_special_needs": has_special_needs, "new_status": new_status},
        session_id=session_id,
    )

    # Fire email notification
    if user_row and user_row[0]:
        try:
            send_application_submitted_email(
                to_email=user_row[0],
                first_name=user_row[1] or "Student",
                matric_number=student["identifier"],
                has_special_needs=has_special_needs,
            )
        except Exception:
            pass  # Never block on email failures

    return {
        "message": "Application submitted successfully",
        "application_id": app_id,
        "status": new_status,
        "has_special_needs": has_special_needs,
    }


# ── Status ───────────────────────────────────────────────────────────────────

@router.get("/status")
def get_application_status(student=Depends(get_current_student)):
    """Get the student's full application pipeline status."""
    with get_cursor() as cur:
        session = _get_active_session(cur)
        if not session:
            return {"has_application": False}

        cur.execute(
            """SELECT ha.id, ha.status, ha.stage_completed, ha.has_special_needs,
                      ha.special_needs_type, ha.medical_doc_original_name, ha.upload_attempt,
                      ha.medical_review_notes, ha.medical_reviewed_at,
                      ha.choice_1_id, ha.choice_2_id, ha.special_notes, ha.submitted_at,
                      h1.name, h2.name,
                      ha.admin_status_note, ha.admin_status_updated_at
               FROM hostel_applications ha
               LEFT JOIN hostels h1 ON h1.id = ha.choice_1_id
               LEFT JOIN hostels h2 ON h2.id = ha.choice_2_id
               WHERE ha.student_id = %s AND ha.session_id = %s""",
            (student["user_id"], session[0]),
        )
        row = cur.fetchone()

    if not row:
        return {"has_application": False}

    return {
        "has_application": True,
        "id": row[0],
        "status": row[1],
        "stage_completed": row[2],
        "has_special_needs": row[3],
        "special_needs_type": row[4],
        "medical_doc_name": row[5],
        "upload_attempt": row[6],
        "max_upload_attempts": MAX_UPLOAD_ATTEMPTS,
        "medical_review_notes": row[7],
        "medical_reviewed_at": row[8].isoformat() if row[8] else None,
        "choices": [
            {"id": row[9], "name": row[13]} if row[9] else None,
            {"id": row[10], "name": row[14]} if row[10] else None,
        ],
        "special_notes": row[11],
        "submitted_at": row[12].isoformat() if row[12] else None,
        "admin_status_note": row[15],
        "admin_status_updated_at": row[16].isoformat() if row[16] else None,
    }


# ── Fee Summary (kept for backward compat but not used in wizard) ────────────

@router.get("/fee-summary")
def get_fee_summary(student=Depends(get_current_student)):
    """Return the itemised fee breakdown for the student's study type."""
    with get_cursor() as cur:
        session = _get_active_session(cur)
        if not session:
            raise HTTPException(status_code=404, detail="No active session")

        cur.execute(
            "SELECT study_type, level FROM users WHERE id = %s",
            (student["user_id"],),
        )
        user_row = cur.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")

        study_type = user_row[0] or "Full-time"
        level = user_row[1] or ""

        amount_col = {
            "Full-time": "amount_fulltime",
            "Part-time": "amount_parttime",
            "CODFEL": "amount_codfel",
        }.get(study_type, "amount_fulltime")

        cur.execute(
            f"""SELECT id, name, {amount_col} as amount, applies_to, is_mandatory, sort_order
                FROM fee_components
                WHERE session_id = %s
                ORDER BY sort_order, id""",
            (session[0],),
        )
        components = cur.fetchall()

    is_fresher = level in ("100L", "ND1")
    applicable = []
    total = 0

    for comp in components:
        comp_id, name, amount, applies_to, is_mandatory, sort_order = comp
        if applies_to == "fulltime_only" and study_type != "Full-time":
            continue
        if applies_to == "parttime_only" and study_type != "Part-time":
            continue
        if applies_to == "codfel_only" and study_type != "CODFEL":
            continue
        if applies_to == "freshers_only" and not is_fresher:
            continue

        applicable.append({
            "id": comp_id,
            "name": name,
            "amount_kobo": amount,
            "amount_naira": amount / 100,
            "amount": amount / 100,
            "is_mandatory": is_mandatory,
        })
        total += amount

    return {
        "study_type": study_type,
        "level": level,
        "components": applicable,
        "total_kobo": total,
        "total_naira": total / 100,
        "total": total / 100,
    }
