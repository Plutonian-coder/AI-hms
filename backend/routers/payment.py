"""
Payment Router — Paystack integration with multi-component fees.

Flow: Student has submitted application → fee computed from fee_components →
      Paystack transaction initialized → Student pays → Callback verifies →
      HMS receipt reference generated → confirmed_payment + component_log created.

Allocation happens AFTER the quiz (Phase 3), not here.
"""
import json
import hmac
import hashlib
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from database import get_cursor, get_connection
from dependencies import get_current_student
from config import PAYSTACK_SECRET_KEY, PAYSTACK_CALLBACK_URL
from services.receipt import generate_hms_reference
from services.audit_logger import log_event, PAYMENT_INITIALIZED, PAYMENT_CONFIRMED, PAYMENT_FAILED
from services.email import send_payment_receipt_email

router = APIRouter(prefix="/api/v1/payment", tags=["payment"])

PAYSTACK_BASE = "https://api.paystack.co"
TOTAL_STEPS = 5


# ── SSE Helpers ──────────────────────────────────────────────────────────────

def _sse_step(step: int, status: str, title: str, detail: str) -> str:
    payload = json.dumps({"step": step, "total": TOTAL_STEPS, "status": status, "title": title, "detail": detail})
    return f"event: step\ndata: {payload}\n\n"


def _sse_error(step: int, title: str, detail: str) -> str:
    payload = json.dumps({"step": step, "total": TOTAL_STEPS, "title": title, "detail": detail})
    return f"event: error\ndata: {payload}\n\n"


def _sse_result(data: dict) -> str:
    return f"event: result\ndata: {json.dumps(data)}\n\n"


class PaymentInitRequest(BaseModel):
    fee_type: str = "hostel"

# ── Fee Calculation ──────────────────────────────────────────────────────────

def _compute_fee(session_id: int, study_type: str, level: str, fee_type: str = "hostel"):
    """Compute total fee and applicable components for a student based on fee_type."""
    amount_col = {
        "Full-time": "amount_fulltime",
        "Part-time": "amount_parttime",
        "CODFEL": "amount_codfel",
    }.get(study_type, "amount_fulltime")

    is_fresher = level in ("100L", "ND1")

    with get_cursor() as cur:
        cur.execute(
            f"""SELECT id, name, {amount_col} as amount, applies_to, is_mandatory
                FROM fee_components WHERE session_id = %s AND fee_type = %s ORDER BY sort_order, id""",
            (session_id, fee_type),
        )
        all_components = cur.fetchall()

    applicable = []
    total = 0
    for comp_id, name, amount, applies_to, is_mandatory in all_components:
        if applies_to == "fulltime_only" and study_type != "Full-time":
            continue
        if applies_to == "parttime_only" and study_type != "Part-time":
            continue
        if applies_to == "codfel_only" and study_type != "CODFEL":
            continue
        if applies_to == "freshers_only" and not is_fresher:
            continue
        applicable.append({"id": comp_id, "name": name, "amount_kobo": amount})
        total += amount

    return applicable, total


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/initialize")
def initialize_payment(data: PaymentInitRequest, student=Depends(get_current_student)):
    """
    Initialize a Paystack transaction. Fee is computed from session fee_components.
    Student must have met prerequisites depending on fee_type.
    """
    student_id = student["user_id"]
    fee_type = data.fee_type
    
    if fee_type not in ("application", "hostel"):
        raise HTTPException(status_code=400, detail="Invalid fee type. Must be 'application' or 'hostel'.")

    with get_cursor() as cur:
        # Active session with payment portal open
        cur.execute(
            """SELECT id, session_name, payment_portal_open, year_end
               FROM academic_sessions WHERE is_active = TRUE LIMIT 1"""
        )
        sess = cur.fetchone()
        if not sess:
            raise HTTPException(status_code=400, detail="No active academic session.")
        if not sess[2]:
            raise HTTPException(status_code=403, detail="Payment portal is currently closed.")

        session_id, session_name, _, year_end = sess

        if fee_type == "application":
            # Must have completed at least stage 3 of the application
            cur.execute(
                """SELECT id, status, stage_completed
                   FROM hostel_applications
                   WHERE student_id = %s AND session_id = %s""",
                (student_id, session_id),
            )
            app_row = cur.fetchone()
            if not app_row or app_row[2] < 3:
                raise HTTPException(status_code=403, detail="You need to complete all application stages before paying the application fee.")
                
            # Must not have already paid application fee
            cur.execute("""
                SELECT cp.id FROM confirmed_payments cp
                JOIN payment_component_log pcl ON pcl.payment_id = cp.id
                JOIN fee_components fc ON fc.id = pcl.component_id
                WHERE cp.student_id = %s AND cp.session_id = %s AND cp.status IN ('confirmed', 'pending')
                  AND fc.fee_type = 'application'
            """, (student_id, session_id))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="You already have an application fee payment for this session.")
                
        else:
            # fee_type == "hostel"
            # Must be allocated
            cur.execute(
                "SELECT id FROM allocations WHERE student_id = %s AND session_id = %s AND status = 'active'",
                (student_id, session_id),
            )
            if not cur.fetchone():
                raise HTTPException(status_code=403, detail="You must be allocated a bed before paying hostel fees.")
                
            # Must not have already paid hostel fee
            cur.execute("""
                SELECT cp.id FROM confirmed_payments cp
                JOIN payment_component_log pcl ON pcl.payment_id = cp.id
                JOIN fee_components fc ON fc.id = pcl.component_id
                WHERE cp.student_id = %s AND cp.session_id = %s AND cp.status IN ('confirmed', 'pending')
                  AND fc.fee_type = 'hostel'
            """, (student_id, session_id))
            if cur.fetchone():
                raise HTTPException(status_code=409, detail="You already have a hostel fee payment for this session.")

        # Clean up any failed pending payment attempts (where paystack_id was never generated)
        cur.execute(
            "DELETE FROM confirmed_payments WHERE student_id = %s AND session_id = %s AND status = 'pending' AND paystack_id IS NULL",
            (student_id, session_id),
        )

        # Get student info for fee calculation and Paystack
        cur.execute(
            "SELECT email, surname, first_name, study_type, level FROM users WHERE id = %s",
            (student_id,),
        )
        user_row = cur.fetchone()
        if not user_row or not user_row[0]:
            raise HTTPException(status_code=400, detail="Please set your email address before paying.")

    email, surname, first_name, study_type, level = user_row

    # Compute fee
    components, total_kobo = _compute_fee(session_id, study_type or "Full-time", level or "", fee_type)
    if total_kobo <= 0:
        raise HTTPException(status_code=400, detail="No fee components configured for this session.")

    # Generate HMS reference early (to include in metadata)
    hms_ref = generate_hms_reference(year_end or 2026)

    # Create pending confirmed_payment record and initialize Paystack in a single transaction.
    # If the Paystack call or authorization fails, the database transaction is automatically rolled back.
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO confirmed_payments
                   (student_id, session_id, hms_reference, total_amount_kobo, status)
                   VALUES (%s, %s, %s, %s, 'pending') RETURNING id""",
                (student_id, session_id, hms_ref, total_kobo),
            )
            payment_id = cur.fetchone()[0]

            # Initialize Paystack
            try:
                with httpx.Client() as client:
                    resp = client.post(
                        f"{PAYSTACK_BASE}/transaction/initialize",
                        json={
                            "email": email,
                            "amount": total_kobo,
                            "callback_url": PAYSTACK_CALLBACK_URL,
                            "metadata": {
                                "student_id": student_id,
                                "session_id": session_id,
                                "payment_id": payment_id,
                                "hms_reference": hms_ref,
                                "student_name": f"{surname} {first_name}",
                            },
                        },
                        headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"},
                        timeout=30,
                    )
            except Exception as e:
                print(f"Paystack request failed to connect: {e}", flush=True)
                raise HTTPException(
                    status_code=502,
                    detail="Paystack gateway is unreachable. Please verify your internet connection."
                )

            if resp.status_code != 200:
                print(f"Paystack initialization failed. Status: {resp.status_code}, Response: {resp.text}", flush=True)
                raise HTTPException(
                    status_code=502,
                    detail=f"Failed to initialize payment with Paystack. Code: {resp.status_code}. Response: {resp.text}"
                )

            data = resp.json()
            if not data.get("status"):
                raise HTTPException(status_code=502, detail=data.get("message", "Paystack initialization failed."))

            reference = data["data"]["reference"]
            authorization_url = data["data"]["authorization_url"]

            # Store Paystack reference
            cur.execute(
                "UPDATE confirmed_payments SET paystack_id = %s WHERE id = %s",
                (reference, payment_id),
            )

    log_event(
        PAYMENT_INITIALIZED, "student", student["identifier"],
        f"Initialized payment of ₦{total_kobo // 100:,}",
        target_entity="payment", target_id=str(payment_id),
        metadata={"hms_reference": hms_ref, "amount_kobo": total_kobo},
        session_id=session_id,
    )

    return {
        "authorization_url": authorization_url,
        "reference": reference,
        "hms_reference": hms_ref,
        "amount_naira": total_kobo // 100,
        "components": components,
    }


def _confirm_payment_internal(payment_id: int, channel: str, reference: str = None):
    """Internal helper to finalize a payment: update DB, log components, update application status."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            # 1. Get payment details
            cur.execute(
                "SELECT student_id, session_id, hms_reference, total_amount_kobo FROM confirmed_payments WHERE id = %s",
                (payment_id,)
            )
            cp = cur.fetchone()
            if not cp: return False
            student_id, session_id, hms_ref, total_kobo = cp

            # 2. Update status
            cur.execute(
                """UPDATE confirmed_payments
                   SET status = 'confirmed', paystack_status = 'success',
                       payment_channel = %s, paystack_id = COALESCE(%s, paystack_id), confirmed_at = NOW()
                   WHERE id = %s AND status = 'pending'""",
                (channel, reference, payment_id),
            )
            if cur.rowcount == 0: return False # already confirmed

            # 3. Log components
            # Note: We don't know the fee_type statically here, so we compute both to find the matching total, 
            # or better yet, we should look up which fee type this pending payment was for.
            # But wait, we didn't store fee_type in confirmed_payments.
            # Let's compute both and see which one matches the total_amount_kobo.
            cur.execute("SELECT study_type, level FROM users WHERE id = %s", (student_id,))
            u = cur.fetchone()
            
            app_components, app_total = _compute_fee(session_id, u[0] or "Full-time", u[1] or "", "application")
            hostel_components, hostel_total = _compute_fee(session_id, u[0] or "Full-time", u[1] or "", "hostel")
            
            if total_kobo == app_total and app_total > 0:
                components = app_components
                paid_fee_type = "application"
            else:
                components = hostel_components
                paid_fee_type = "hostel"
                
            for comp in components:
                cur.execute(
                    """INSERT INTO payment_component_log (payment_id, component_id, component_name, amount_kobo)
                       VALUES (%s, %s, %s, %s)""",
                    (payment_id, comp["id"], comp["name"], comp["amount_kobo"]),
                )

            # 4. Update application status if it was hostel fee
            if paid_fee_type == "hostel":
                cur.execute(
                    "UPDATE hostel_applications SET status = 'paid' WHERE student_id = %s AND session_id = %s",
                    (student_id, session_id),
                )

            # 5. Audit log + receipt email
            cur.execute("SELECT identifier, email, surname, first_name FROM users WHERE id = %s", (student_id,))
            u2 = cur.fetchone()
            ident, student_email, surname, first_name = u2
            log_event(
                PAYMENT_CONFIRMED, "student", ident,
                f"Payment confirmed: {hms_ref} — ₦{total_kobo // 100:,}",
                target_entity="payment", target_id=str(payment_id),
                metadata={"hms_reference": hms_ref, "amount": total_kobo, "channel": channel},
                session_id=session_id,
            )
            conn.commit()

    # Send receipt email outside the DB transaction
    if student_email:
        try:
            send_payment_receipt_email(
                to_email=student_email,
                first_name=first_name,
                total_naira=total_kobo / 100,
                hms_ref=hms_ref,
                fee_type=paid_fee_type,
                matric=ident,
                user_id=student_id,
                session_id=session_id,
            )
        except Exception as e:
            print(f"[WARN] Receipt email failed: {e}", flush=True)
    return True



@router.get("/verify/{reference}")
def verify_payment(reference: str, student=Depends(get_current_student)):
    """Verify Paystack payment via SSE, confirm payment, log components, update application status."""
    student_id = student["user_id"]

    def pipeline():
        # Step 1: Find payment record
        yield _sse_step(1, "processing", "Finding Payment", "Looking up payment record...")

        with get_cursor() as cur:
            cur.execute(
                """SELECT cp.id, cp.session_id, cp.hms_reference, cp.total_amount_kobo, cp.status,
                          s.year_end
                   FROM confirmed_payments cp
                   JOIN academic_sessions s ON s.id = cp.session_id
                   WHERE cp.paystack_id = %s AND cp.student_id = %s""",
                (reference, student_id),
            )
            cp = cur.fetchone()

        if not cp:
            yield _sse_error(1, "Finding Payment", "Payment record not found.")
            return

        payment_id, session_id, hms_ref, expected_amount, cp_status, year_end = cp

        if cp_status == "confirmed":
            yield _sse_error(1, "Finding Payment", "This payment has already been confirmed.")
            return

        yield _sse_step(1, "complete", "Finding Payment", f"Found: {hms_ref}")

        # Step 2: Verify with Paystack API
        yield _sse_step(2, "processing", "Verifying with Paystack", "Contacting payment gateway...")

        with httpx.Client() as client:
            resp = client.get(
                f"{PAYSTACK_BASE}/transaction/verify/{reference}",
                headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"},
                timeout=30,
            )

        if resp.status_code != 200:
            yield _sse_error(2, "Verifying with Paystack", "Could not verify with Paystack.")
            return

        ps_data = resp.json()
        if not ps_data.get("status") or ps_data["data"]["status"] != "success":
            with get_cursor() as cur:
                cur.execute("UPDATE confirmed_payments SET status = 'failed', paystack_status = %s WHERE id = %s",
                            (ps_data["data"].get("status", "unknown"), payment_id))
            log_event(PAYMENT_FAILED, "student", student["identifier"],
                      "Payment verification failed", target_entity="payment", target_id=str(payment_id),
                      session_id=session_id)
            yield _sse_error(2, "Verifying with Paystack",
                             f"Payment not successful: {ps_data['data'].get('status', 'unknown')}")
            return

        paid_amount = ps_data["data"]["amount"]
        channel = ps_data["data"].get("channel", "unknown")

        if paid_amount < expected_amount:
            yield _sse_error(2, "Verifying with Paystack",
                             f"Amount mismatch. Expected ₦{expected_amount // 100:,}, got ₦{paid_amount // 100:,}")
            return

        yield _sse_step(2, "complete", "Verifying with Paystack", f"Payment confirmed — ₦{paid_amount // 100:,}")

        # Step 3: Update payment records in DB
        yield _sse_step(3, "processing", "Finalizing Payment", "Updating payment records...")
        success = _confirm_payment_internal(payment_id, channel, reference)
        if not success:
            yield _sse_error(3, "Finalizing Payment", "Payment was already processed or failed to finalize.")
            return
        yield _sse_step(3, "complete", "Finalizing Payment", "Payment records updated.")

        # Step 4: Log fee component breakdown
        yield _sse_step(4, "processing", "Logging Components", "Recording fee breakdown...")
        yield _sse_step(4, "complete", "Logging Components", "Fee breakdown recorded.")

        # Step 5: Generate receipt
        yield _sse_step(5, "processing", "Generating Receipt", "Preparing your receipt...")
        yield _sse_step(5, "complete", "Generating Receipt", f"Receipt ready: {hms_ref}")

        # Determine which fee type was just paid
        with get_cursor() as cur:
            cur.execute(
                """SELECT fc.fee_type FROM payment_component_log pcl
                   JOIN fee_components fc ON fc.id = pcl.component_id
                   WHERE pcl.payment_id = %s LIMIT 1""",
                (payment_id,)
            )
            ft_row = cur.fetchone()
            paid_fee_type = ft_row[0] if ft_row else "application"

        yield _sse_result({
            "hms_reference": hms_ref,
            "amount_paid": paid_amount // 100,
            "payment_channel": channel,
            "payment_id": payment_id,
            "fee_type": paid_fee_type,
        })


    return StreamingResponse(pipeline(), media_type="text/event-stream")


@router.post("/webhook")
async def paystack_webhook(request: Request):
    """Paystack webhook — backup confirmation path."""
    body = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    expected = hmac.new(PAYSTACK_SECRET_KEY.encode(), body, hashlib.sha512).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid signature")

    event = json.loads(body)
    if event.get("event") != "charge.success":
        return {"status": "ignored"}

    data = event["data"]
    reference = data["reference"]
    channel = data.get("channel", "unknown")
    metadata = data.get("metadata", {})
    payment_id = metadata.get("payment_id")

    if not payment_id:
        return {"status": "missing metadata"}

    # Use internal helper
    success = _confirm_payment_internal(payment_id, channel, reference)
    if success:
        return {"status": "confirmed"}
    return {"status": "already processed or error"}


@router.post("/cancel-pending")
def cancel_pending_payment(student=Depends(get_current_student)):
    """Cancel a stale pending payment so the student can retry."""
    student_id = student["user_id"]

    with get_cursor() as cur:
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        sess = cur.fetchone()
        if not sess:
            raise HTTPException(status_code=400, detail="No active session.")

        cur.execute(
            "DELETE FROM confirmed_payments WHERE student_id = %s AND session_id = %s AND status = 'pending'",
            (student_id, sess[0]),
        )
        deleted = cur.rowcount

    if deleted == 0:
        raise HTTPException(status_code=404, detail="No pending payment to cancel.")

    return {"message": "Pending payment cancelled. You can now retry."}


@router.get("/status")
def get_payment_status(fee_type: str = "hostel", student=Depends(get_current_student)):
    """Check if the student has a payment (pending or confirmed) for the active session, for a specific fee_type."""
    student_id = student["user_id"]
    with get_cursor() as cur:
        # Get active session
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE")
        sess = cur.fetchone()
        if not sess:
            return {"has_payment": False}
        session_id = sess[0]

        cur.execute(
            """
            SELECT cp.status, cp.hms_reference, cp.total_amount_kobo, cp.paystack_status, cp.paystack_id
            FROM confirmed_payments cp
            JOIN payment_component_log pcl ON pcl.payment_id = cp.id
            JOIN fee_components fc ON fc.id = pcl.component_id
            WHERE cp.student_id = %s AND cp.session_id = %s AND cp.status IN ('confirmed', 'pending')
              AND fc.fee_type = %s
            """,
            (student_id, session_id, fee_type),
        )
        row = cur.fetchone()
        if not row:
            return {"has_payment": False}

        status, hms_ref, kobo, p_status, reference = row
        return {
            "has_payment": True,
            "status": status,
            "hms_reference": hms_ref,
            "amount_naira": kobo // 100 if kobo else 0,
            "paystack_status": p_status,
            "reference": reference,
        }


@router.get("/receipt")
def get_receipt(student=Depends(get_current_student)):
    """Get full receipt data for the current session's payment."""
    student_id = student["user_id"]

    with get_cursor() as cur:
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        sess = cur.fetchone()
        if not sess:
            raise HTTPException(status_code=404, detail="No active session")

        cur.execute(
            """SELECT cp.id, cp.hms_reference, cp.total_amount_kobo, cp.status,
                      cp.payment_channel, cp.confirmed_at, cp.paystack_id,
                      u.identifier, u.surname, u.first_name, u.department,
                      u.level, u.study_type, s.session_name
               FROM confirmed_payments cp
               JOIN users u ON u.id = cp.student_id
               JOIN academic_sessions s ON s.id = cp.session_id
               WHERE cp.student_id = %s AND cp.session_id = %s AND cp.status = 'confirmed'""",
            (student_id, sess[0]),
        )
        pay = cur.fetchone()
        if not pay:
            raise HTTPException(status_code=404, detail="No confirmed payment found")

        # Get component breakdown
        cur.execute(
            """SELECT component_name, amount_kobo FROM payment_component_log
               WHERE payment_id = %s ORDER BY id""",
            (pay[0],),
        )
        components = cur.fetchall()

        # Get hostel choices
        cur.execute(
            """SELECT h1.name, h2.name, h3.name
               FROM hostel_applications ha
               LEFT JOIN hostels h1 ON h1.id = ha.choice_1_id
               LEFT JOIN hostels h2 ON h2.id = ha.choice_2_id
               LEFT JOIN hostels h3 ON h3.id = ha.choice_3_id
               WHERE ha.student_id = %s AND ha.session_id = %s""",
            (student_id, sess[0]),
        )
        choices = cur.fetchone()

    return {
        "hms_reference": pay[1],
        "paystack_reference": pay[6],
        "amount": pay[2] // 100,
        "status": pay[3],
        "payment_channel": pay[4],
        "paid_at": pay[5].isoformat() if pay[5] else None,
        "student_name": f"{pay[8]} {pay[9]}",
        "identifier": pay[7],
        "department": pay[10],
        "level": pay[11],
        "study_type": pay[12],
        "session_name": pay[13],
        "components": [
            {"name": c[0], "amount": c[1] // 100}
            for c in components
        ],
        "hostel_choices": [c for c in choices if c] if choices else [],
    }


@router.get("/receipt/pdf")
def download_receipt_pdf(student=Depends(get_current_student)):
    """Generate and return the receipt as a downloadable PDF."""
    # Reuse the receipt data helper
    receipt_data = get_receipt(student)

    from services.receipt_pdf import generate_receipt_pdf
    pdf_bytes = generate_receipt_pdf(receipt_data)

    hms_ref = receipt_data.get("hms_reference", "receipt").replace("/", "-")
    filename = f"HMS_Receipt_{hms_ref}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )

