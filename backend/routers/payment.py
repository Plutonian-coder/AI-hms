"""
Payment Router — Paystack integration for hostel allocation payments.

Flow: Student selects hostel preferences → Paystack transaction initialized →
      Student pays on Paystack checkout → Callback/webhook verifies →
      FCFS bed allocation executed atomically.

Pricing: Per-hostel per-program pricing from hostel_prices table,
         with fallback to HOSTEL_FEE_AMOUNT env var.
"""
import json
import hmac
import hashlib
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from database import get_cursor, get_connection
from dependencies import get_current_student
from config import PAYSTACK_SECRET_KEY, HOSTEL_FEE_AMOUNT, PAYSTACK_CALLBACK_URL


class PaymentRequest(BaseModel):
    choice_1_id: int
    choice_2_id: int
    choice_3_id: int

router = APIRouter(prefix="/api/v1/payment", tags=["payment"])

PAYSTACK_BASE = "https://api.paystack.co"
TOTAL_STEPS = 4

VALID_PROGRAM_TYPES = {"ND_FT", "ND_PT", "HND_FT", "HND_PT"}


# ---- Helpers ----

def _derive_program_type(level: str | None, study_mode: str | None) -> str | None:
    """Derive program_type from level and study_mode. Returns e.g. 'ND_FT', 'HND_PT'."""
    if not level or not study_mode:
        return None
    level_upper = level.strip().upper()
    if level_upper in ("ND1", "ND2"):
        prefix = "ND"
    elif level_upper in ("HND1", "HND2"):
        prefix = "HND"
    else:
        return None
    suffix = "FT" if study_mode == "full_time" else "PT"
    return f"{prefix}_{suffix}"


def _get_hostel_price(hostel_id: int, program_type: str | None) -> int:
    """Look up price from hostel_prices table. Falls back to HOSTEL_FEE_AMOUNT."""
    if program_type:
        with get_cursor() as cur:
            cur.execute(
                "SELECT amount FROM hostel_prices WHERE hostel_id = %s AND program_type = %s",
                (hostel_id, program_type),
            )
            row = cur.fetchone()
            if row:
                return row[0]
    return HOSTEL_FEE_AMOUNT


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

@router.get("/price")
def get_hostel_price(
    hostel_id: int = Query(...),
    student=Depends(get_current_student),
):
    """Get the hostel fee for a specific hostel based on the student's program type."""
    student_id = student["user_id"]

    # Get student's level and study_mode
    with get_cursor() as cur:
        cur.execute("SELECT level, study_mode FROM users WHERE id = %s", (student_id,))
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Student not found")

    level, study_mode = row
    program_type = _derive_program_type(level, study_mode)

    # Get hostel name
    with get_cursor() as cur:
        cur.execute("SELECT name FROM hostels WHERE id = %s", (hostel_id,))
        hostel_row = cur.fetchone()

    if not hostel_row:
        raise HTTPException(status_code=404, detail="Hostel not found")

    amount = _get_hostel_price(hostel_id, program_type)

    # Format program type for display
    display_map = {
        "ND_FT": "ND Full Time",
        "ND_PT": "ND Part Time",
        "HND_FT": "HND Full Time",
        "HND_PT": "HND Part Time",
    }

    return {
        "amount": amount,
        "program_type": program_type,
        "program_label": display_map.get(program_type, "Standard"),
        "hostel_name": hostel_row[0],
    }


@router.post("/initialize")
def initialize_payment(
    body: PaymentRequest,
    student=Depends(get_current_student),
):
    """
    Initialize a Paystack transaction for hostel allocation.
    Student must be eligible for the current session.
    Returns Paystack authorization_url for redirect.
    """
    choice_1_id = body.choice_1_id
    choice_2_id = body.choice_2_id
    choice_3_id = body.choice_3_id
    student_id = student["user_id"]

    # Get active session
    with get_cursor() as cur:
        cur.execute("SELECT id, allocation_portal_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        sess = cur.fetchone()

    if not sess:
        raise HTTPException(status_code=400, detail="No active academic session found.")
    if not sess[1]:
        raise HTTPException(status_code=400, detail="The allocation portal is currently closed.")
    session_id = sess[0]

    # Check eligibility
    with get_cursor() as cur:
        cur.execute(
            "SELECT is_eligible FROM eligibility_status WHERE student_id = %s AND session_id = %s",
            (student_id, session_id),
        )
        elig = cur.fetchone()

    if not elig or not elig[0]:
        raise HTTPException(status_code=403, detail="You are not eligible for hostel allocation. Complete eligibility verification first.")

    # Check not already allocated
    with get_cursor() as cur:
        cur.execute(
            "SELECT id FROM allocations WHERE student_id = %s AND session_id = %s AND status = 'active'",
            (student_id, session_id),
        )
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="You already have an active allocation for this session.")

    # Check no pending payment
    with get_cursor() as cur:
        cur.execute(
            "SELECT id FROM pending_payments WHERE student_id = %s AND session_id = %s AND status = 'pending'",
            (student_id, session_id),
        )
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="You already have a pending payment. Complete or cancel it first.")

    # Get student email, level, study_mode (required for pricing)
    with get_cursor() as cur:
        cur.execute("SELECT email, surname, first_name, level, study_mode FROM users WHERE id = %s", (student_id,))
        user_row = cur.fetchone()

    if not user_row or not user_row[0]:
        raise HTTPException(status_code=400, detail="Please set your email address in your profile before making a payment.")

    email, surname, first_name, level, study_mode = user_row

    # Determine price from first-choice hostel + student's program type
    program_type = _derive_program_type(level, study_mode)
    amount_naira = _get_hostel_price(choice_1_id, program_type)
    amount_kobo = amount_naira * 100

    with httpx.Client() as client:
        resp = client.post(
            f"{PAYSTACK_BASE}/transaction/initialize",
            json={
                "email": email,
                "amount": amount_kobo,
                "callback_url": PAYSTACK_CALLBACK_URL,
                "metadata": {
                    "student_id": student_id,
                    "session_id": session_id,
                    "choice_1_id": choice_1_id,
                    "choice_2_id": choice_2_id,
                    "choice_3_id": choice_3_id,
                    "student_name": f"{surname} {first_name}",
                    "program_type": program_type,
                },
            },
            headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"},
            timeout=30,
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Failed to initialize payment with Paystack.")

    data = resp.json()
    if not data.get("status"):
        raise HTTPException(status_code=502, detail=data.get("message", "Paystack initialization failed."))

    reference = data["data"]["reference"]
    authorization_url = data["data"]["authorization_url"]

    # Store pending payment
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO pending_payments (student_id, session_id, paystack_reference, choice_1_id, choice_2_id, choice_3_id, amount_kobo)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (student_id, session_id, reference, choice_1_id, choice_2_id, choice_3_id, amount_kobo))

    return {
        "authorization_url": authorization_url,
        "reference": reference,
        "amount": amount_naira,
    }


@router.delete("/cancel")
def cancel_pending_payment(student=Depends(get_current_student)):
    """Cancel a pending (unpaid) Paystack payment so the student can start fresh."""
    student_id = student["user_id"]

    with get_cursor() as cur:
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        sess = cur.fetchone()

    if not sess:
        raise HTTPException(status_code=400, detail="No active academic session.")

    session_id = sess[0]

    with get_cursor() as cur:
        cur.execute(
            "DELETE FROM pending_payments WHERE student_id = %s AND session_id = %s AND status = 'pending'",
            (student_id, session_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="No pending payment found to cancel.")

    return {"message": "Pending payment cancelled. You can now start a new payment."}


@router.get("/verify/{reference}")
def verify_payment(reference: str, student=Depends(get_current_student)):
    """
    Verify a Paystack payment and trigger FCFS bed allocation (SSE-streamed).
    Called after Paystack redirects back to the callback URL.
    """
    student_id = student["user_id"]

    def pipeline():
        # ── Step 1: Verify Payment Reference ──
        yield _sse_step(1, "processing", "Verifying Payment", "Checking payment reference with Paystack...")

        # Look up pending payment
        with get_cursor() as cur:
            cur.execute(
                "SELECT id, session_id, choice_1_id, choice_2_id, choice_3_id, status, amount_kobo FROM pending_payments WHERE paystack_reference = %s AND student_id = %s",
                (reference, student_id),
            )
            pp = cur.fetchone()

        if not pp:
            yield _sse_error(1, "Verifying Payment", "Payment reference not found. Please contact admin.")
            return

        pp_id, session_id, c1, c2, c3, pp_status, expected_amount = pp

        if pp_status == "completed":
            yield _sse_error(1, "Verifying Payment", "This payment has already been processed.")
            return

        # Verify with Paystack API
        with httpx.Client() as client:
            resp = client.get(
                f"{PAYSTACK_BASE}/transaction/verify/{reference}",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"},
                timeout=30,
            )

        if resp.status_code != 200:
            yield _sse_error(1, "Verifying Payment", "Could not verify payment with Paystack. Try again.")
            return

        ps_data = resp.json()
        if not ps_data.get("status") or ps_data["data"]["status"] != "success":
            with get_cursor() as cur:
                cur.execute("UPDATE pending_payments SET status = 'failed' WHERE id = %s", (pp_id,))
            yield _sse_error(1, "Verifying Payment", f"Payment was not successful. Status: {ps_data['data'].get('status', 'unknown')}")
            return

        # Verify amount
        paid_amount = ps_data["data"]["amount"]
        if paid_amount < expected_amount:
            yield _sse_error(1, "Verifying Payment", f"Amount mismatch. Expected \u20a6{expected_amount // 100:,}, got \u20a6{paid_amount // 100:,}")
            return

        yield _sse_step(1, "complete", "Verifying Payment", f"Payment confirmed — \u20a6{paid_amount // 100:,}")

        # ── Step 2: Check Eligibility ──
        yield _sse_step(2, "processing", "Eligibility Check", "Confirming your eligibility...")

        with get_cursor() as cur:
            cur.execute(
                "SELECT is_eligible FROM eligibility_status WHERE student_id = %s AND session_id = %s",
                (student_id, session_id),
            )
            elig = cur.fetchone()

        if not elig or not elig[0]:
            yield _sse_error(2, "Eligibility Check", "Your eligibility could not be confirmed. Contact admin.")
            return

        yield _sse_step(2, "complete", "Eligibility Check", "Eligibility confirmed")

        # ── Step 3: Check Session Still Active ──
        yield _sse_step(3, "processing", "Session Validation", "Verifying session is still active...")

        with get_cursor() as cur:
            cur.execute("SELECT is_active FROM academic_sessions WHERE id = %s", (session_id,))
            sess_row = cur.fetchone()

        if not sess_row or not sess_row[0]:
            yield _sse_error(3, "Session Validation", "The academic session has ended. Contact admin for a refund.")
            return

        yield _sse_step(3, "complete", "Session Validation", "Session is active")

        # ── Step 4: Atomic Bed Allocation ──
        yield _sse_step(4, "processing", "Bed Allocation", "Securing your bed space...")

        choices = [c1, c2, c3]
        try:
            with get_connection() as conn:
                cur = conn.cursor()
                try:
                    # Mark pending payment as completed
                    cur.execute(
                        "UPDATE pending_payments SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = %s AND status = 'pending'",
                        (pp_id,),
                    )
                    if cur.rowcount == 0:
                        yield _sse_error(4, "Bed Allocation", "Payment was already processed by another request.")
                        return

                    cur.execute("SELECT * FROM allocate_bed(%s, %s, %s, %s)", (student_id, choices, session_id, reference))
                finally:
                    cur.close()
        except Exception as e:
            error_msg = str(e)
            if "already has an allocation" in error_msg:
                yield _sse_error(4, "Bed Allocation", "You already have an allocation for this session.")
            elif "No vacant beds" in error_msg:
                yield _sse_error(4, "Bed Allocation", "No vacant beds available in your chosen hostels. Contact admin for a refund.")
            else:
                yield _sse_error(4, "Bed Allocation", "Allocation failed. Please contact admin.")
            return

        yield _sse_step(4, "complete", "Bed Allocation", "Bed space secured!")

        # Fetch allocation details
        allocation = _fetch_allocation(student_id)
        if allocation:
            yield _sse_result(allocation)
        else:
            yield _sse_result({"message": "Allocated successfully"})

    return StreamingResponse(pipeline(), media_type="text/event-stream")


@router.post("/webhook")
async def paystack_webhook(request: Request):
    """
    Paystack webhook endpoint — backup allocation path.
    Verifies HMAC signature, processes charge.success events.
    """
    body = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    # Verify signature
    expected = hmac.new(
        PAYSTACK_SECRET_KEY.encode(),
        body,
        hashlib.sha512,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    event = json.loads(body)
    if event.get("event") != "charge.success":
        return {"status": "ignored"}

    data = event["data"]
    reference = data["reference"]
    metadata = data.get("metadata", {})
    student_id = metadata.get("student_id")
    session_id = metadata.get("session_id")

    if not student_id or not session_id:
        return {"status": "missing metadata"}

    # Check if already processed
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, status FROM pending_payments WHERE paystack_reference = %s",
            (reference,),
        )
        pp = cur.fetchone()

    if not pp or pp[1] == "completed":
        return {"status": "already processed"}

    pp_id = pp[0]
    choices = [
        metadata.get("choice_1_id"),
        metadata.get("choice_2_id"),
        metadata.get("choice_3_id"),
    ]

    if not all(choices):
        return {"status": "missing choices in metadata"}

    # Attempt allocation
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            try:
                cur.execute(
                    "UPDATE pending_payments SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = %s AND status = 'pending'",
                    (pp_id,),
                )
                if cur.rowcount == 0:
                    return {"status": "already processed"}

                cur.execute("SELECT * FROM allocate_bed(%s, %s, %s, %s)", (student_id, choices, session_id, reference))
            finally:
                cur.close()
    except Exception as e:
        print(f"Webhook allocation error: {e}")
        return {"status": "allocation_failed", "error": str(e)}

    return {"status": "allocated"}


@router.get("/status")
def get_payment_status(student=Depends(get_current_student)):
    """Check if student has any pending/completed payments for the current session."""
    student_id = student["user_id"]

    with get_cursor() as cur:
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        sess = cur.fetchone()

    if not sess:
        return {"has_pending": False, "has_completed": False}

    session_id = sess[0]

    with get_cursor() as cur:
        cur.execute(
            "SELECT status, paystack_reference, amount_kobo, created_at FROM pending_payments WHERE student_id = %s AND session_id = %s ORDER BY created_at DESC LIMIT 1",
            (student_id, session_id),
        )
        row = cur.fetchone()

    if not row:
        return {"has_pending": False, "has_completed": False}

    return {
        "has_pending": row[0] == "pending",
        "has_completed": row[0] == "completed",
        "reference": row[1],
        "status": row[0],
        "amount": row[2] // 100 if row[2] else None,
        "created_at": row[3].isoformat() if row[3] else None,
    }


# ---- Helpers ----

def _fetch_allocation(student_id: int) -> dict | None:
    """Fetch current allocation details for a student."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT h.name, bl.name, r.room_number, b.bed_number
            FROM allocations a
            JOIN academic_sessions sess ON sess.id = a.session_id
            JOIN beds b    ON b.id  = a.bed_id
            JOIN rooms r   ON r.id  = b.room_id
            JOIN blocks bl ON bl.id = r.block_id
            JOIN hostels h ON h.id  = bl.hostel_id
            WHERE a.student_id = %s AND sess.is_active = TRUE AND a.status = 'active'
        """, (student_id,))
        row = cur.fetchone()

    if not row:
        return None

    return {
        "hostel_name": row[0],
        "block_name": row[1],
        "room_number": row[2],
        "bed_number": row[3],
    }
