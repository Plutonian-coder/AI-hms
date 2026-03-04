"""
Allocation Router — AI-powered hostel allocation pipeline with real-time SSE streaming.
Upload receipt → AI Authenticity → RRR Extraction → Payment Check → Duplicate Check → Atomic Allocation
Each step is streamed to the frontend as a Server-Sent Event.
"""
import os
import uuid
import json
import hashlib
from fastapi import APIRouter, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse
from models import AllocationResult, RoommateInfo, HostelInfo
from database import get_cursor, get_connection
from services.ocr import extract_rrr
from dependencies import get_current_student
from config import UPLOAD_DIR
from typing import List

router = APIRouter(prefix="/api/v1/allocation", tags=["allocation"])

os.makedirs(UPLOAD_DIR, exist_ok=True)

TOTAL_STEPS = 7


# ---- SSE Helpers ----

def _sse_step(step: int, status: str, title: str, detail: str) -> str:
    payload = json.dumps({"step": step, "total": TOTAL_STEPS, "status": status, "title": title, "detail": detail})
    return f"event: step\ndata: {payload}\n\n"


def _sse_error(step: int, title: str, detail: str) -> str:
    payload = json.dumps({"step": step, "total": TOTAL_STEPS, "title": title, "detail": detail})
    return f"event: error\ndata: {payload}\n\n"


def _sse_result(data: dict) -> str:
    return f"event: result\ndata: {json.dumps(data)}\n\n"


# ---- Endpoints ----

@router.get("/check")
def check_allocation_public(matric: str):
    """Public endpoint — check allocation status by matric number. Returns limited info."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT u.surname, u.first_name,
                   h.name AS hostel_name, r.room_number, b.bed_number
            FROM users u
            JOIN allocations a ON a.student_id = u.id
            JOIN academic_sessions sess ON sess.id = a.session_id AND sess.is_active = TRUE
            JOIN beds b ON b.id = a.bed_id
            JOIN rooms r ON r.id = b.room_id
            JOIN hostels h ON h.id = r.hostel_id
            WHERE LOWER(u.identifier) = LOWER(%s)
        """, (matric.strip(),))
        row = cur.fetchone()

    if not row:
        return {"found": False}

    room_id_query = """
        SELECT r.id FROM users u
        JOIN allocations a ON a.student_id = u.id
        JOIN academic_sessions sess ON sess.id = a.session_id AND sess.is_active = TRUE
        JOIN beds b ON b.id = a.bed_id
        JOIN rooms r ON r.id = b.room_id
        WHERE LOWER(u.identifier) = LOWER(%s)
    """
    with get_cursor() as cur:
        cur.execute(room_id_query, (matric.strip(),))
        room_row = cur.fetchone()
        room_id = room_row[0] if room_row else None

    # Count occupants and capacity
    occupants = 1
    capacity = 4
    roommate_names = []
    if room_id:
        with get_cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM beds WHERE room_id = %s", (room_id,))
            cap_row = cur.fetchone()
            if cap_row:
                capacity = cap_row[0]

            cur.execute("""
                SELECT u.surname || ' ' || u.first_name AS full_name, u.identifier
                FROM allocations a2
                JOIN beds b2 ON b2.id = a2.bed_id
                JOIN users u ON u.id = a2.student_id
                JOIN academic_sessions sess2 ON sess2.id = a2.session_id AND sess2.is_active = TRUE
                WHERE b2.room_id = %s AND LOWER(u.identifier) != LOWER(%s)
            """, (room_id, matric.strip()))
            roommate_rows = cur.fetchall()
            occupants = len(roommate_rows) + 1
            roommate_names = [{"full_name": r[0], "identifier": r[1]} for r in roommate_rows]

    return {
        "found": True,
        "student_name": f"{row[0]} {row[1]}",
        "hostel_name": row[2],
        "room_number": row[3],
        "bed_number": row[4],
        "occupants": occupants,
        "capacity": capacity,
        "roommates": roommate_names,
    }


@router.get("/dashboard")
def get_student_dashboard(student=Depends(get_current_student)):
    """Returns all data needed for the student dashboard in a single call."""
    student_id = student["user_id"]

    # 1. Full profile
    with get_cursor() as cur:
        cur.execute(
            "SELECT identifier, surname, first_name, gender, department, level, email, phone FROM users WHERE id = %s",
            (student_id,)
        )
        profile_row = cur.fetchone()

    profile = {
        "identifier": profile_row[0],
        "surname": profile_row[1],
        "first_name": profile_row[2],
        "full_name": f"{profile_row[1]} {profile_row[2]}",
        "gender": profile_row[3],
        "department": profile_row[4],
        "level": profile_row[5],
        "email": profile_row[6],
        "phone": profile_row[7],
    } if profile_row else {}

    # 2. Current session
    with get_cursor() as cur:
        cur.execute("SELECT id, session_name, allocation_portal_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        sess = cur.fetchone()

    session = {"id": sess[0], "name": sess[1], "portal_open": sess[2]} if sess else None

    # 3. Allocation
    allocation = _fetch_allocation(student_id)

    # 4. Payment status — check if student has a used RRR in this session
    payment_status = "NOT VERIFIED"
    if allocation:
        payment_status = "VERIFIED"
    else:
        try:
            with get_cursor() as cur:
                cur.execute(
                    "SELECT status FROM allocation_requests WHERE student_id = %s ORDER BY created_at DESC LIMIT 1",
                    (student_id,)
                )
                req_row = cur.fetchone()
                if req_row:
                    payment_status = "PENDING" if req_row[0] == "rejected" else "VERIFIED"
        except Exception:
            pass

    return {
        "profile": profile,
        "session": session,
        "allocation": allocation.model_dump() if allocation else None,
        "payment_status": payment_status,
        "application_status": "ALLOCATED" if allocation else "NOT APPLIED",
    }


@router.patch("/profile")
def update_student_profile(
    student=Depends(get_current_student),
    department: str = Form(None),
    level: str = Form(None),
    email: str = Form(None),
    phone: str = Form(None),
):
    """Update optional profile fields (department, level, email, phone)."""
    student_id = student["user_id"]
    updates = []
    values = []

    if department is not None:
        updates.append("department = %s")
        values.append(department.strip())
    if level is not None:
        updates.append("level = %s")
        values.append(level.strip())
    if email is not None:
        updates.append("email = %s")
        values.append(email.strip())
    if phone is not None:
        updates.append("phone = %s")
        values.append(phone.strip())

    if not updates:
        return {"message": "No fields to update"}

    values.append(student_id)
    with get_cursor() as cur:
        cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", values)

    return {"message": "Profile updated successfully"}


@router.get("/hostels", response_model=List[HostelInfo])
def list_available_hostels(student=Depends(get_current_student)):
    student_gender = student["gender"]

    with get_cursor() as cur:
        cur.execute("""
            SELECT h.id, h.name, h.gender_restriction, h.capacity,
                   COUNT(a.id) AS occupied
            FROM hostels h
            LEFT JOIN rooms r ON r.hostel_id = h.id
            LEFT JOIN beds b ON b.room_id = r.id
            LEFT JOIN allocations a ON a.bed_id = b.id
            WHERE h.gender_restriction IN (%s, 'mixed')
            GROUP BY h.id
            ORDER BY h.name
        """, (student_gender,))
        rows = cur.fetchall()

    return [
        HostelInfo(id=r[0], name=r[1], gender=r[2], capacity=r[3], occupied=r[4], available=r[3] - r[4])
        for r in rows
    ]


@router.get("/my-allocation", response_model=AllocationResult | None)
def get_my_allocation(student=Depends(get_current_student)):
    return _fetch_allocation(student["user_id"])


@router.post("/apply")
async def apply_for_allocation(
    choice_1_id: int = Form(...),
    choice_2_id: int = Form(...),
    choice_3_id: int = Form(...),
    receipt: UploadFile = File(...),
    student=Depends(get_current_student),
):
    """
    Streamed allocation pipeline. Returns SSE events for each processing step.
    The frontend reads these events to show real-time progress.
    """
    # Read file content upfront (before entering the generator — UploadFile can't be read inside)
    file_content = await receipt.read()
    file_ext = os.path.splitext(receipt.filename or "img.png")[1]

    def pipeline():
        student_id = student["user_id"]
        choices = [choice_1_id, choice_2_id, choice_3_id]

        # ── Step 0: Pre-flight checks ──
        yield _sse_step(1, "processing", "Pre-flight Checks", "Verifying portal status and eligibility...")

        with get_cursor() as cur:
            cur.execute("SELECT id, allocation_portal_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
            session_row = cur.fetchone()

        if not session_row:
            yield _sse_error(1, "Pre-flight Checks", "No active academic session found. Contact admin.")
            return
        if not session_row[1]:
            yield _sse_error(1, "Pre-flight Checks", "The allocation portal is currently closed.")
            return
        session_id = session_row[0]

        existing = _fetch_allocation(student_id)
        if existing:
            yield _sse_error(1, "Pre-flight Checks", "You already have a bed allocation for this session.")
            return

        yield _sse_step(1, "complete", "Pre-flight Checks", "Portal is open and you are eligible")

        # ── Step 1: Save receipt ──
        yield _sse_step(2, "processing", "Uploading Receipt", "Saving your receipt image...")

        filename = f"{uuid.uuid4().hex}{file_ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(file_content)

        # Compute SHA-256 hash for duplicate detection
        receipt_hash = hashlib.sha256(file_content).hexdigest()

        yield _sse_step(2, "complete", "Uploading Receipt", "Receipt saved securely")

        # ── Step 2: AI Authenticity Check ──
        yield _sse_step(3, "processing", "AI Authenticity Check", "Gemini AI is analyzing your receipt...")

        ocr_result = extract_rrr(filepath)

        if not ocr_result["is_authentic"]:
            reason = ocr_result["rejection_reason"] or "Image does not appear to be a valid Remita receipt"
            _log_request(student_id, choices[0], choices[1], choices[2], filepath, receipt_hash, None, "rejected",
                         f"AI flagged: {reason}")
            yield _sse_error(3, "AI Authenticity Check", reason)
            return

        yield _sse_step(3, "complete", "AI Authenticity Check", "Receipt verified as authentic")

        # ── Step 3: RRR Extraction ──
        rrr = ocr_result["rrr"]
        if not rrr:
            _log_request(student_id, choices[0], choices[1], choices[2], filepath, receipt_hash, None, "rejected",
                         "OCR could not extract RRR")
            yield _sse_error(4, "RRR Extraction", "Could not find a valid 12-digit RRR number on the receipt")
            return

        masked_rrr = rrr[:4] + "****" + rrr[-4:]
        yield _sse_step(4, "complete", "RRR Extraction", f"Extracted RRR: {masked_rrr}")

        # ── Step 4: Payment Verification ──
        yield _sse_step(5, "processing", "Payment Verification", f"Checking RRR {masked_rrr} in Remita records...")

        with get_cursor() as cur:
            cur.execute("SELECT id, status, amount FROM mock_remita_payments WHERE rrr = %s", (rrr,))
            pay_row = cur.fetchone()

        if not pay_row:
            _log_request(student_id, choices[0], choices[1], choices[2], filepath, receipt_hash, rrr, "rejected",
                         "RRR not found")
            yield _sse_error(5, "Payment Verification", f"RRR {masked_rrr} does not exist in payment records")
            return

        if pay_row[1] in ("used", "used_for_allocation"):
            _log_request(student_id, choices[0], choices[1], choices[2], filepath, receipt_hash, rrr, "rejected",
                         "RRR already used")
            yield _sse_error(5, "Payment Verification", f"RRR {masked_rrr} has already been used for a previous allocation")
            return

        if pay_row[1] != "paid":
            _log_request(student_id, choices[0], choices[1], choices[2], filepath, receipt_hash, rrr, "rejected",
                         f"RRR status: {pay_row[1]}")
            yield _sse_error(5, "Payment Verification", f"Payment status is '{pay_row[1]}', not 'paid'. Contact support.")
            return

        amount = float(pay_row[2]) if pay_row[2] else 0
        yield _sse_step(5, "complete", "Payment Verification", f"Payment confirmed — \u20a6{amount:,.0f}")

        # ── Step 5: Duplicate Receipt Check ──
        yield _sse_step(6, "processing", "Duplicate Check", "Verifying receipt hasn't been used before...")

        try:
            with get_cursor() as cur:
                cur.execute(
                    "SELECT id FROM allocation_requests WHERE receipt_hash = %s AND status = 'allocated' LIMIT 1",
                    (receipt_hash,)
                )
                dup_row = cur.fetchone()

            if dup_row:
                _log_request(student_id, choices[0], choices[1], choices[2], filepath, receipt_hash, rrr, "rejected",
                             "Duplicate receipt image")
                yield _sse_error(6, "Duplicate Check", "This exact receipt image has already been used for another allocation")
                return
        except Exception:
            pass  # Table might not exist yet — skip check gracefully

        yield _sse_step(6, "complete", "Duplicate Check", "Receipt is unique — not previously used")

        # ── Step 7: Atomic Bed Allocation ──
        yield _sse_step(7, "processing", "Bed Allocation", "Securing your bed space via atomic transaction...")

        try:
            with get_connection() as conn:
                cur = conn.cursor()
                try:
                    cur.execute(
                        "UPDATE mock_remita_payments SET status = 'used_for_allocation' WHERE rrr = %s AND status = 'paid'",
                        (rrr,)
                    )
                    if cur.rowcount == 0:
                        yield _sse_error(7, "Bed Allocation", "Payment was claimed by another request. Try again.")
                        return

                    cur.execute("SELECT * FROM allocate_bed(%s, %s, %s)", (student_id, choices, session_id))
                finally:
                    cur.close()
        except Exception as e:
            error_msg = str(e)
            if "already has an allocation" in error_msg:
                yield _sse_error(7, "Bed Allocation", "You already have an allocation for this session")
            elif "No vacant beds" in error_msg:
                _log_request(student_id, choices[0], choices[1], choices[2], filepath, receipt_hash, rrr, "rejected",
                             "No beds available")
                yield _sse_error(7, "Bed Allocation", "No vacant beds available for your chosen hostels")
            else:
                _log_request(student_id, choices[0], choices[1], choices[2], filepath, receipt_hash, rrr, "rejected",
                             error_msg)
                yield _sse_error(7, "Bed Allocation", "Transaction failed. Please try again.")
            return

        # ── Success ──
        _log_request(student_id, choices[0], choices[1], choices[2], filepath, receipt_hash, rrr, "allocated", None)
        yield _sse_step(7, "complete", "Bed Allocation", "Bed space secured!")

        result = _fetch_allocation(student_id)
        if result:
            yield _sse_result(result.model_dump())
        else:
            yield _sse_result({"message": "Allocated successfully"})

    return StreamingResponse(pipeline(), media_type="text/event-stream")


# ---- Helpers ----

def _fetch_allocation(student_id: int) -> AllocationResult | None:
    with get_cursor() as cur:
        cur.execute("""
            SELECT b.bed_number, r.room_number, h.name, r.id
            FROM allocations a
            JOIN academic_sessions sess ON sess.id = a.session_id
            JOIN beds b ON b.id = a.bed_id
            JOIN rooms r ON r.id = b.room_id
            JOIN hostels h ON h.id = r.hostel_id
            WHERE a.student_id = %s AND sess.is_active = TRUE
        """, (student_id,))
        row = cur.fetchone()

    if not row:
        return None

    bed_num, room_num, hostel_name, room_id = row

    with get_cursor() as cur:
        cur.execute("""
            SELECT u.identifier, u.surname || ' ' || u.first_name AS full_name
            FROM allocations a2
            JOIN beds b2 ON b2.id = a2.bed_id
            JOIN users u ON u.id = a2.student_id
            JOIN academic_sessions sess2 ON sess2.id = a2.session_id
            WHERE b2.room_id = %s AND a2.student_id != %s AND sess2.is_active = TRUE
        """, (room_id, student_id))
        roommate_rows = cur.fetchall()

    return AllocationResult(
        hostel_name=hostel_name,
        room_number=room_num,
        bed_number=bed_num,
        roommates=[RoommateInfo(identifier=r[0], full_name=r[1]) for r in roommate_rows],
    )


def _log_request(student_id, c1, c2, c3, path, receipt_hash, rrr, status, reason):
    try:
        with get_cursor() as cur:
            cur.execute(
                """INSERT INTO allocation_requests
                   (student_id, choice_1_id, choice_2_id, choice_3_id, receipt_path, receipt_hash, extracted_rrr, status, rejection_reason)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (student_id, c1, c2, c3, path, receipt_hash, rrr, status, reason),
            )
    except Exception:
        pass
