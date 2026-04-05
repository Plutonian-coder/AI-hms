"""
Application Router — Hostel application form submission.

Students select 3 ranked hostel preferences and review the itemised fee summary.
Gate: student must be registered (matric verified via session_register).
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from database import get_cursor
from dependencies import get_current_student
from services.audit_logger import log_event, APPLICATION_SUBMITTED

router = APIRouter(prefix="/api/v1/application", tags=["application"])


class ApplicationSubmit(BaseModel):
    choice_1_id: int
    choice_2_id: int
    choice_3_id: int
    special_notes: Optional[str] = None


def _get_active_session(cur):
    cur.execute(
        """SELECT id, session_name, application_portal_open
           FROM academic_sessions WHERE is_active = TRUE LIMIT 1"""
    )
    return cur.fetchone()


@router.post("/submit")
def submit_application(data: ApplicationSubmit, student=Depends(get_current_student)):
    """Submit a hostel application with 3 ranked preferences."""
    with get_cursor() as cur:
        session = _get_active_session(cur)
        if not session:
            raise HTTPException(status_code=404, detail="No active session")
        if not session[2]:
            raise HTTPException(status_code=403, detail="Application portal is currently closed")

        session_id = session[0]

        # Check student is in the session register
        cur.execute(
            "SELECT id FROM session_register WHERE session_id = %s AND matric_number = %s",
            (session_id, student["identifier"]),
        )
        if not cur.fetchone():
            raise HTTPException(
                status_code=403,
                detail="Your matric number is not in the current session register. Contact admin.",
            )

        # Check for existing application
        cur.execute(
            "SELECT id, status FROM hostel_applications WHERE student_id = %s AND session_id = %s",
            (student["user_id"], session_id),
        )
        existing = cur.fetchone()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"You already have an application (status: {existing[1]})",
            )

        # Validate hostel choices exist and match gender
        gender = student["gender"]
        for choice_id, label in [
            (data.choice_1_id, "1st"),
            (data.choice_2_id, "2nd"),
            (data.choice_3_id, "3rd"),
        ]:
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
                raise HTTPException(
                    status_code=400,
                    detail=f"{label} choice hostel does not match your gender",
                )

        # Insert application
        cur.execute(
            """INSERT INTO hostel_applications
               (student_id, session_id, choice_1_id, choice_2_id, choice_3_id, special_notes)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (
                student["user_id"],
                session_id,
                data.choice_1_id,
                data.choice_2_id,
                data.choice_3_id,
                data.special_notes,
            ),
        )
        app_id = cur.fetchone()[0]

    log_event(
        APPLICATION_SUBMITTED, "student", student["identifier"],
        f"Submitted hostel application with preferences",
        target_entity="hostel_application", target_id=str(app_id),
        metadata={
            "choice_1": data.choice_1_id,
            "choice_2": data.choice_2_id,
            "choice_3": data.choice_3_id,
        },
        session_id=session_id,
    )

    return {"message": "Application submitted successfully", "application_id": app_id}


@router.get("/status")
def get_application_status(student=Depends(get_current_student)):
    """Get the student's application status for the current session."""
    with get_cursor() as cur:
        session = _get_active_session(cur)
        if not session:
            return {"has_application": False}

        cur.execute(
            """SELECT ha.id, ha.status, ha.choice_1_id, ha.choice_2_id, ha.choice_3_id,
                      ha.special_notes, ha.submitted_at,
                      h1.name, h2.name, h3.name
               FROM hostel_applications ha
               LEFT JOIN hostels h1 ON h1.id = ha.choice_1_id
               LEFT JOIN hostels h2 ON h2.id = ha.choice_2_id
               LEFT JOIN hostels h3 ON h3.id = ha.choice_3_id
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
        "choice_1_id": row[2],
        "choice_2_id": row[3],
        "choice_3_id": row[4],
        "choices": [
            {"id": row[2], "name": row[7]},
            {"id": row[3], "name": row[8]},
            {"id": row[4], "name": row[9]},
        ],
        "special_notes": row[5],
        "submitted_at": row[6].isoformat() if row[6] else None,
    }


@router.get("/fee-summary")
def get_fee_summary(student=Depends(get_current_student)):
    """Return the itemised fee breakdown for the student's study type."""
    with get_cursor() as cur:
        session = _get_active_session(cur)
        if not session:
            raise HTTPException(status_code=404, detail="No active session")

        # Get student's study_type and level
        cur.execute(
            "SELECT study_type, level FROM users WHERE id = %s",
            (student["user_id"],),
        )
        user_row = cur.fetchone()
        if not user_row:
            raise HTTPException(status_code=404, detail="User not found")

        study_type = user_row[0] or "Full-time"
        level = user_row[1] or ""

        # Determine which amount column to use
        amount_col = {
            "Full-time": "amount_fulltime",
            "Part-time": "amount_parttime",
            "Sandwich": "amount_sandwich",
        }.get(study_type, "amount_fulltime")

        # Get all applicable fee components
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

        # Filter by applies_to
        if applies_to == "fulltime_only" and study_type != "Full-time":
            continue
        if applies_to == "parttime_only" and study_type != "Part-time":
            continue
        if applies_to == "sandwich_only" and study_type != "Sandwich":
            continue
        if applies_to == "freshers_only" and not is_fresher:
            continue

        applicable.append({
            "id": comp_id,
            "name": name,
            "amount_kobo": amount,
            "amount_naira": amount / 100,
            "amount": amount / 100,  # Frontend compatible
            "is_mandatory": is_mandatory,
        })
        total += amount

    return {
        "study_type": study_type,
        "level": level,
        "components": applicable,
        "total_kobo": total,
        "total_naira": total / 100,
        "total": total / 100,  # Frontend compatible
    }
