"""
Allocation Router — Dashboard, allocation details, hostel listing, profile updates, photo upload.

The actual allocation is triggered by the quiz router (quiz.py).
This router provides read endpoints for the student portal.
"""
import os
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from database import get_cursor
from dependencies import get_current_student
from services.storage import upload_file_to_s3
from config import UPLOAD_DIR

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/allocation", tags=["allocation"])

ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_PHOTO_SIZE = 2 * 1024 * 1024  # 2MB


# ── Public: Check allocation by matric ───────────────────────────────────────

@router.get("/check")
def check_allocation_public(matric: str):
    """Public endpoint — check allocation status by matric number or name."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT u.surname, u.first_name, u.department, u.level,
                   h.name, bl.name, r.room_number, b.bed_number, r.id,
                   a.avg_compatibility_score, a.matched_from_preference, u.id
            FROM users u
            JOIN allocations a ON a.student_id = u.id AND a.status = 'active'
            JOIN academic_sessions sess ON sess.id = a.session_id AND sess.is_active = TRUE
            JOIN beds b ON b.id = a.bed_id
            JOIN rooms r ON r.id = b.room_id
            JOIN blocks bl ON bl.id = r.block_id
            JOIN hostels h ON h.id = bl.hostel_id
            WHERE LOWER(TRIM(u.identifier)) = LOWER(TRIM(%s))
               OR LOWER(TRIM(u.surname || ' ' || u.first_name)) = LOWER(TRIM(%s))
               OR LOWER(TRIM(u.first_name || ' ' || u.surname)) = LOWER(TRIM(%s))
        """, (matric.strip(), matric.strip(), matric.strip()))
        row = cur.fetchone()

    if not row:
        return {"found": False}

    room_id = row[8]
    user_id = row[11]

    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM beds WHERE room_id = %s", (room_id,))
        capacity = cur.fetchone()[0]

        cur.execute("""
            SELECT u.surname || ' ' || u.first_name, u.identifier
            FROM allocations a2
            JOIN beds b2 ON b2.id = a2.bed_id
            JOIN users u ON u.id = a2.student_id
            JOIN academic_sessions s ON s.id = a2.session_id AND s.is_active = TRUE
            WHERE b2.room_id = %s AND u.id != %s AND a2.status = 'active'
        """, (room_id, user_id))
        roommate_rows = cur.fetchall()

    return {
        "found": True,
        "student_name": f"{row[0]} {row[1]}",
        "department": row[2],
        "level": row[3],
        "hostel_name": row[4],
        "block_name": row[5],
        "room_number": row[6],
        "bed_number": row[7],
        "occupants": len(roommate_rows) + 1,
        "capacity": capacity,
        "compatibility_score": float(row[9]) if row[9] else None,
        "matched_from_preference": row[10],
        "roommates": [{"full_name": r[0], "identifier": r[1]} for r in roommate_rows],
    }


@router.get("/verify/{reference:path}")
def verify_hostel_pass(reference: str):
    """Public endpoint — verify hostel pass validity by payment reference.

    :path because HMS references carry slashes (FUOYE/2025/00003). The server
    percent-decodes the URL before routing, so a plain {reference} would see
    three segments and 404 — which the scanner reports as a forged pass."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT u.surname, u.first_name, u.identifier, u.department, u.level,
                   h.name, bl.name, r.room_number, b.bed_number, u.passport_photo_url,
                   sess.session_name
            FROM confirmed_payments cp
            JOIN allocations a ON a.student_id = cp.student_id AND a.session_id = cp.session_id AND a.status = 'active'
            JOIN users u ON u.id = a.student_id
            JOIN academic_sessions sess ON sess.id = a.session_id AND sess.is_active = TRUE
            JOIN beds b ON b.id = a.bed_id
            JOIN rooms r ON r.id = b.room_id
            JOIN blocks bl ON bl.id = r.block_id
            JOIN hostels h ON h.id = bl.hostel_id
            JOIN payment_component_log pcl ON pcl.payment_id = cp.id
            JOIN fee_components fc ON fc.id = pcl.component_id AND fc.fee_type = 'hostel'
            WHERE cp.hms_reference = %s AND cp.status = 'confirmed'
        """, (reference.strip(),))
        row = cur.fetchone()

    if not row:
        return {"valid": False}

    return {
        "valid": True,
        "student_name": f"{row[0]} {row[1]}",
        "identifier": row[2],
        "department": row[3],
        "level": row[4],
        "hostel_name": row[5],
        "block_name": row[6],
        "room_number": row[7],
        "bed_number": row[8],
        "photo_url": row[9] if row[9] and row[9].startswith("http") else (f"/api/v1/allocation/photo/{row[2]}" if row[9] else None),
        "session_name": row[10]
    }


# ── Student Dashboard ────────────────────────────────────────────────────────

@router.get("/dashboard")
def get_student_dashboard(student=Depends(get_current_student)):
    """Returns all data for the student dashboard — profile, session, 6-step progress."""
    student_id = student["user_id"]

    # Profile
    with get_cursor() as cur:
        cur.execute(
            """SELECT identifier, surname, first_name, gender, department, level,
                      email, phone, next_of_kin_name, next_of_kin_phone, study_type,
                      passport_photo_url
               FROM users WHERE id = %s""",
            (student_id,),
        )
        p = cur.fetchone()

    profile = {
        "user_id": student_id,
        "identifier": p[0], "surname": p[1], "first_name": p[2],
        "full_name": f"{p[1]} {p[2]}", "gender": p[3],
        "department": p[4], "level": p[5], "email": p[6], "phone": p[7],
        "next_of_kin_name": p[8], "next_of_kin_phone": p[9],
        "study_type": p[10] or "Full-time",
        "passport_photo_url": p[11],
        "photo_url": p[11] if p[11] and p[11].startswith("http") else (f"/api/v1/allocation/photo/{student_id}" if p[11] else None),
    } if p else {}

    # Session
    with get_cursor() as cur:
        cur.execute(
            """SELECT id, session_name, application_portal_open, payment_portal_open, allocation_portal_open,
                      hostel_fee_deadline
               FROM academic_sessions WHERE is_active = TRUE LIMIT 1"""
        )
        sess = cur.fetchone()

    session = None
    session_id = None
    if sess:
        session_id = sess[0]
        session = {
            "id": sess[0], "name": sess[1],
            "application_open": sess[2], "payment_open": sess[3], "allocation_open": sess[4],
            "hostel_fee_deadline": sess[5].isoformat() if sess[5] else None,
        }

    # 6-step progress
    has_application = False
    application_status = None
    has_payment = False
    payment_status = None
    fuoye_reference = None
    has_quiz = False
    has_allocation = False
    allocation = None

    if session_id:
        with get_cursor() as cur:
            # Application
            cur.execute(
                "SELECT status FROM hostel_applications WHERE student_id = %s AND session_id = %s",
                (student_id, session_id),
            )
            app_row = cur.fetchone()
            if app_row:
                application_status = app_row[0]
                has_application = application_status not in ('draft',)

            # Payment - Application Fee
            cur.execute(
                """SELECT cp.status, cp.hms_reference 
                   FROM confirmed_payments cp
                   JOIN payment_component_log pcl ON pcl.payment_id = cp.id
                   JOIN fee_components fc ON fc.id = pcl.component_id
                   WHERE cp.student_id = %s AND cp.session_id = %s AND fc.fee_type = 'application'
                   ORDER BY cp.id DESC LIMIT 1""",
                (student_id, session_id),
            )
            app_pay_row = cur.fetchone()
            app_fee_paid = False
            app_payment_status = None
            if app_pay_row:
                app_payment_status = app_pay_row[0]
                app_fee_paid = (app_payment_status == "confirmed")
                fuoye_reference = app_pay_row[1]

            # Payment - Hostel Fee
            cur.execute(
                """SELECT cp.status, cp.hms_reference 
                   FROM confirmed_payments cp
                   JOIN payment_component_log pcl ON pcl.payment_id = cp.id
                   JOIN fee_components fc ON fc.id = pcl.component_id
                   WHERE cp.student_id = %s AND cp.session_id = %s AND fc.fee_type = 'hostel'
                   ORDER BY cp.id DESC LIMIT 1""",
                (student_id, session_id),
            )
            hostel_pay_row = cur.fetchone()
            hostel_fee_paid = False
            hostel_payment_status = None
            if hostel_pay_row:
                hostel_payment_status = hostel_pay_row[0]
                hostel_fee_paid = (hostel_payment_status == "confirmed")
                fuoye_reference = hostel_pay_row[1]

            # Quiz
            cur.execute(
                "SELECT id FROM student_vectors WHERE student_id = %s AND session_id = %s",
                (student_id, session_id),
            )
            has_quiz = cur.fetchone() is not None

        # Allocation
        allocation = _fetch_allocation(student_id, session_id)
        has_allocation = allocation is not None

    return {
        "profile": profile,
        "session": session,
        "progress": {
            "registered": True,
            "applied": has_application,
            "application_status": application_status,
            "app_fee_paid": app_fee_paid,
            "app_payment_status": app_payment_status,
            "quiz_completed": has_quiz,
            "allocated": has_allocation,
            "hostel_fee_paid": hostel_fee_paid,
            "hostel_payment_status": hostel_payment_status,
            "hms_reference": fuoye_reference,
        },
        "allocation": allocation,
    }


# ── Hostel Listing ───────────────────────────────────────────────────────────

@router.get("/hostels")
def list_hostels(student=Depends(get_current_student)):
    """List active hostels matching student's gender, with occupancy."""
    gender = student["gender"]

    with get_cursor() as cur:
        # Capacity comes from the beds that actually exist rather than the
        # denormalized hostels.capacity column, which goes stale and made
        # available beds read as negative.
        cur.execute("""
            SELECT h.id, h.name, h.gender_restriction, h.status,
                   COUNT(DISTINCT b.id) AS capacity,
                   COUNT(DISTINCT b.id) FILTER (WHERE b.status = 'occupied') AS occupied
            FROM hostels h
            LEFT JOIN blocks bl ON bl.hostel_id = h.id
            LEFT JOIN rooms r ON r.block_id = bl.id
            LEFT JOIN beds b ON b.room_id = r.id
            WHERE h.status = 'active'
              AND (h.gender_restriction = %s OR h.gender_restriction = 'mixed')
            GROUP BY h.id
            ORDER BY h.name
        """, (gender,))
        rows = cur.fetchall()

    return [
        {
            "id": r[0], "name": r[1], "gender": r[2], "status": r[3],
            "capacity": r[4], "occupied": r[5],
            "available": max(r[4] - r[5], 0),
            "occupancy_pct": round(r[5] / r[4] * 100, 1) if r[4] > 0 else 0,
        }
        for r in rows
    ]


# ── My Allocation ────────────────────────────────────────────────────────────

@router.get("/my-allocation")
def get_my_allocation(student=Depends(get_current_student)):
    """Get the student's current allocation with roommate compatibility details."""
    student_id = student["user_id"]

    with get_cursor() as cur:
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        sess = cur.fetchone()
        if not sess:
            raise HTTPException(status_code=404, detail="No active session")

    session_id = sess[0]
    allocation = _fetch_allocation(student_id, session_id)

    if not allocation:
        raise HTTPException(status_code=404, detail="No allocation found for this session")

    return allocation


# ── Profile Update ───────────────────────────────────────────────────────────

class ProfileUpdate(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    next_of_kin_name: Optional[str] = None
    next_of_kin_phone: Optional[str] = None


@router.patch("/profile")
def update_profile(data: ProfileUpdate, student=Depends(get_current_student)):
    """Update optional profile fields (email, phone, next of kin)."""
    updates = []
    params = []

    if data.email is not None:
        updates.append("email = %s")
        params.append(data.email.strip())
    if data.phone is not None:
        updates.append("phone = %s")
        params.append(data.phone.strip())
    if data.next_of_kin_name is not None:
        updates.append("next_of_kin_name = %s")
        params.append(data.next_of_kin_name.strip())
    if data.next_of_kin_phone is not None:
        updates.append("next_of_kin_phone = %s")
        params.append(data.next_of_kin_phone.strip())

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(student["user_id"])
    with get_cursor() as cur:
        cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", params)

    return {"message": "Profile updated"}


# ── Photo Upload ─────────────────────────────────────────────────────────────

@router.post("/photo")
async def upload_photo(file: UploadFile = File(...), student=Depends(get_current_student)):
    """Upload or replace passport photo using Supabase S3."""
    if file.content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WebP images are allowed.")

    contents = await file.read()
    if len(contents) > MAX_PHOTO_SIZE:
        raise HTTPException(status_code=400, detail="Photo must be under 2MB.")

    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'jpg'
    file_id = str(uuid.uuid4())
    object_name = f"photos/{student['user_id']}_{file_id[:8]}.{ext}"
    
    # Upload to S3
    try:
        file_url = upload_file_to_s3(contents, object_name, file.content_type)
    except Exception as e:
        logger.error(f"S3 upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload photo to storage")

    with get_cursor() as cur:
        # Delete old photo if it was a db file (UUID length check roughly) - Legacy cleanup
        cur.execute("SELECT passport_photo_url FROM users WHERE id = %s", (student["user_id"],))
        old_row = cur.fetchone()
        if old_row and old_row[0] and "/api/v1/files/" in old_row[0]:
            old_file_id = old_row[0].split("/")[-1]
            try:
                cur.execute("DELETE FROM files WHERE id = %s", (old_file_id,))
            except Exception:
                pass # Ignore if files table doesn't exist or is dropped

        cur.execute("UPDATE users SET passport_photo_url = %s WHERE id = %s", (file_url, student["user_id"]))

    logger.info("Photo uploaded for user %s: %s", student["user_id"], file_url)
    return {"message": "Photo uploaded", "photo_url": file_url}


# :path — matric numbers carry slashes (FPT/CSC/24/0002), same as above.
@router.get("/photo/{user_id_or_matric:path}")
def get_photo(user_id_or_matric: str):
    """Serve a student's passport photo by ID or Matric."""
    with get_cursor() as cur:
        if user_id_or_matric.isdigit():
            cur.execute("SELECT passport_photo_url FROM users WHERE id = %s", (int(user_id_or_matric),))
        else:
            cur.execute("SELECT passport_photo_url FROM users WHERE identifier = %s", (user_id_or_matric,))
        row = cur.fetchone()

    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="No photo found")

    photo_url = row[0]
    
    # If it's already a full Supabase URL (or any absolute HTTP URL), redirect to it directly.
    if photo_url.startswith("http"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(photo_url)

    # Legacy Postgres DB files fallback
    if photo_url.startswith("/api/v1/files/"):
        file_id = photo_url.split("/")[-1]
        try:
            with get_cursor() as cur:
                cur.execute("SELECT data, content_type FROM files WHERE id = %s", (file_id,))
                f_row = cur.fetchone()
            if f_row:
                return Response(content=f_row[0], media_type=f_row[1])
        except Exception:
            pass

    # Fallback to local disk if migrating old files
    filepath = os.path.join(UPLOAD_DIR, photo_url)
    if os.path.exists(filepath):
        return FileResponse(filepath)

    raise HTTPException(status_code=404, detail="Photo file not found")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _fetch_allocation(student_id: int, session_id: int) -> dict | None:
    """Fetch full allocation details including roommate compatibility."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT a.id, h.name, bl.name, r.room_number, b.bed_number,
                   a.matched_from_preference, a.avg_compatibility_score,
                   a.allocated_at, r.id as room_id, a.payment_id
            FROM allocations a
            JOIN beds b ON b.id = a.bed_id
            JOIN rooms r ON r.id = b.room_id
            JOIN blocks bl ON bl.id = r.block_id
            JOIN hostels h ON h.id = bl.hostel_id
            WHERE a.student_id = %s AND a.session_id = %s AND a.status = 'active'
        """, (student_id, session_id))
        row = cur.fetchone()

    if not row:
        return None

    alloc_id, hostel, block, room_num, bed_num, pref, avg_score, alloc_at, room_id, payment_id = row

    # Get roommates with compatibility scores
    with get_cursor() as cur:
        cur.execute("""
            SELECT u.identifier, u.surname || ' ' || u.first_name,
                   cs.score
            FROM allocations a
            JOIN users u ON u.id = a.student_id
            JOIN beds b ON b.id = a.bed_id AND b.room_id = %s
            LEFT JOIN compatibility_scores cs ON
                ((cs.student_a_id = %s AND cs.student_b_id = a.student_id) OR
                 (cs.student_a_id = a.student_id AND cs.student_b_id = %s))
                AND cs.session_id = %s
            WHERE a.session_id = %s AND a.status = 'active' AND a.student_id != %s
        """, (room_id, student_id, student_id, session_id, session_id, student_id))
        roommates = cur.fetchall()

    # Get student's own vector for radar chart
    with get_cursor() as cur:
        cur.execute(
            "SELECT v1,v2,v3,v4,v5,v6,v7,v8 FROM student_vectors WHERE student_id = %s AND session_id = %s",
            (student_id, session_id),
        )
        vec_row = cur.fetchone()

    student_vector = [float(v) for v in vec_row] if vec_row else []

    # Compute room average vector for radar chart
    room_avg_vector = []
    if roommates:
        with get_cursor() as cur:
            cur.execute("""
                SELECT AVG(sv.v1), AVG(sv.v2), AVG(sv.v3), AVG(sv.v4),
                       AVG(sv.v5), AVG(sv.v6), AVG(sv.v7), AVG(sv.v8)
                FROM student_vectors sv
                JOIN allocations a ON a.student_id = sv.student_id
                    AND a.session_id = %s AND a.status = 'active'
                JOIN beds b ON b.id = a.bed_id AND b.room_id = %s
                WHERE sv.session_id = %s AND sv.student_id != %s
            """, (session_id, room_id, session_id, student_id))
            avg_row = cur.fetchone()
            if avg_row and avg_row[0] is not None:
                room_avg_vector = [round(float(v), 2) for v in avg_row]

    # Get payment reference
    fuoye_reference = None
    if payment_id:
        with get_cursor() as cur:
            cur.execute("SELECT hms_reference FROM confirmed_payments WHERE id = %s", (payment_id,))
            ref_row = cur.fetchone()
            if ref_row:
                fuoye_reference = ref_row[0]

    # Room capacity
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM beds WHERE room_id = %s", (room_id,))
        capacity = cur.fetchone()[0]

    return {
        "allocation_id": alloc_id,
        "hostel_name": hostel,
        "block_name": block,
        "room_number": room_num,
        "bed_number": bed_num,
        "matched_from_preference": pref,
        "avg_compatibility_score": float(avg_score) if avg_score else None,
        "allocated_at": alloc_at.isoformat() if alloc_at else None,
        "hms_reference": fuoye_reference,
        "room_capacity": capacity,
        "occupants": len(roommates) + 1,
        "roommates": [
            {
                "identifier": rm[0],
                "full_name": rm[1],
                "compatibility_score": float(rm[2]) if rm[2] else None,
            }
            for rm in roommates
        ],
        "student_vector": student_vector,
        "room_avg_vector": room_avg_vector,
    }
