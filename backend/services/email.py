"""
Email Service — Rita from FUOYE Hostel Portal

All lifecycle emails for the FUOYE Hostel Management Portal.
Uses Gmail SMTP for reliable delivery to any email address.
Sender persona: "Rita from FUOYE Hostel Portal" — warm but professional.

Every email sent is logged to the email_logs table and audit_logs.

12-Factor Compliant:
  - Factor III: SMTP credentials from centralized config (no hardcoded secrets)
  - Factor XI:  Structured logging to stdout
"""
import json
import logging
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import requests
from config import SMTP_EMAIL, SMTP_APP_PASSWORD, HMS_APP_URL, RESEND_API_KEY, GOOGLE_SCRIPT_URL

logger = logging.getLogger(__name__)

SENDER_NAME = "Rita from FUOYE Hostel Portal"

# ── Shared HTML wrapper ──────────────────────────────────────────────────────

def _wrap_html(title, body_html):
    """Wraps email body in a branded FUOYE HTML template matching the Headspace aesthetic."""
    return f"""
    <div style="background-color: #f8f8f8; padding: 40px 20px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 40px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            
            <!-- Logo Area -->
            <div style="margin-bottom: 30px;">
                <img src="https://iili.io/CIR2W7I.png" alt="FUOYE Logo" style="width: 32px; height: 32px; vertical-align: middle; margin-right: 8px; object-fit: contain; border-radius: 50%;" />
                <span style="color: #111827; font-size: 22px; font-weight: 800; vertical-align: middle; letter-spacing: -0.5px;">FUOYE Hostel Portal</span>
            </div>

            <!-- Dynamic Content (Hero, Heading, Body, Button) -->
            {body_html}

            <!-- Footer Area -->
            <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #f3f4f6;">
                <p style="font-size: 12px; color: #6b7280; line-height: 1.6; margin: 0 0 20px 0;">
                    If you have any questions, please email us at <a href="mailto:khalidyekini80@gmail.com" style="color: #f97316; text-decoration: none; font-weight: bold;">khalidyekini80@gmail.com</a>. Our team can answer questions about your account or help you with your hostel allocation.
                </p>
                <p style="font-size: 11px; color: #9ca3af; margin: 0;">
                    You have received this email as a registered user of FUOYE Hostel Portal<br>
                    Hostel Management Portal, Student Affairs Unit.<br>
                    © 2026 Federal University Oye-Ekiti. All rights reserved.
                </p>
            </div>
        </div>
    </div>
    """


def _log_email(
    to_email: str,
    subject: str,
    body_preview: str,
    email_type: str,
    status: str = "sent",
    recipient_name: str = None,
    recipient_matric: str = None,
    recipient_user_id: int = None,
    session_id: int = None,
    metadata: dict = None,
):
    """Log an email dispatch to the email_logs table and audit trail. Fire-and-forget."""
    try:
        from database import get_cursor
        from services.audit_logger import log_event, EMAIL_SENT

        # Truncate body preview to 500 chars
        preview = (body_preview or "")[:500]

        with get_cursor() as cur:
            cur.execute(
                """INSERT INTO email_logs
                   (recipient_email, recipient_name, recipient_matric, recipient_user_id,
                    subject, body_preview, email_type, status, session_id, metadata)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    to_email,
                    recipient_name,
                    recipient_matric,
                    recipient_user_id,
                    subject,
                    preview,
                    email_type,
                    status,
                    session_id,
                    json.dumps(metadata) if metadata else "{}",
                ),
            )

        # Also record in audit trail
        log_event(
            EMAIL_SENT,
            actor_type="system",
            actor_id="FUOYE_MAILER",
            description=f"Email sent to {to_email}: {subject}",
            target_entity="email",
            target_id=recipient_matric or to_email,
            metadata={
                "email_type": email_type,
                "recipient": to_email,
                "subject": subject,
                "status": status,
            },
            session_id=session_id,
        )
    except Exception:
        logger.error("Failed to log email to DB: type=%s to=%s", email_type, to_email, exc_info=True)


def _send(to_email, subject, html, email_type="general",
          recipient_name=None, recipient_matric=None, recipient_user_id=None,
          session_id=None, extra_metadata=None):
    """Send an email via Google Apps Script (HTTP), Resend (HTTP), or Gmail SMTP and log it. Never raises — logs errors."""
    if not GOOGLE_SCRIPT_URL and not RESEND_API_KEY and (not SMTP_EMAIL or not SMTP_APP_PASSWORD):
        logger.warning("Email not configured (No Google Script, Resend, or SMTP). Email to %s skipped.", to_email)
        return None

    status = "sent"
    try:
        _sent = False

        # ── 1. Try Google Apps Script ──────────────────────────────────────────
        if GOOGLE_SCRIPT_URL and not _sent:
            data = {
                "to": to_email,
                "subject": subject,
                "html": html,
                "senderName": SENDER_NAME
            }
            try:
                res = requests.post(GOOGLE_SCRIPT_URL, json=data, timeout=15, allow_redirects=True)

                if res.status_code >= 400:
                    raise Exception(f"GAS HTTP {res.status_code}: {res.text[:200]}")

                try:
                    gas_json = res.json()
                    if gas_json.get("status") not in ("success", "ok"):
                        raise Exception(f"GAS script error: {gas_json.get('message', res.text[:200])}")
                except ValueError:
                    raise Exception(f"GAS returned non-JSON: {res.text[:200]}")

                logger.info("Email sent to %s via Google Apps Script. Subject: %s", to_email, subject)
                _sent = True
            except Exception as gas_err:
                logger.warning("GAS send failed for %s: %s — trying fallback.", to_email, gas_err)

        # ── 3. Final fallback: Gmail SMTP ──────────────────────────────────────
        if (SMTP_EMAIL and SMTP_APP_PASSWORD) and not _sent:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{SENDER_NAME} <{SMTP_EMAIL}>"
            msg["To"] = to_email

            plain_text = f"This email requires an HTML-capable client. Visit {HMS_APP_URL} for more information."
            msg.attach(MIMEText(plain_text, "plain"))
            msg.attach(MIMEText(html, "html"))

            context = ssl.create_default_context()
            try:
                with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
                    server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
                    server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
            except Exception as e:
                logger.warning(f"SMTP_SSL on 465 failed, trying 587: {e}")
                with smtplib.SMTP("smtp.gmail.com", 587) as server:
                    server.ehlo()
                    server.starttls(context=context)
                    server.ehlo()
                    server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
                    server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
            logger.info("Email sent to %s via SMTP. Subject: %s", to_email, subject)
            _sent = True

        if not _sent:
            raise Exception("All email delivery methods failed or are unconfigured.")

    except Exception as e:
        logger.error("Failed to send email to %s: %s", to_email, str(e))
        status = "failed"

    # Log every email attempt (sent or failed) to email_logs + audit trail
    _log_email(
        to_email=to_email,
        subject=subject,
        body_preview=subject,  # Use subject as preview for brevity
        email_type=email_type,
        status=status,
        recipient_name=recipient_name,
        recipient_matric=recipient_matric,
        recipient_user_id=recipient_user_id,
        session_id=session_id,
        metadata=extra_metadata,
    )

    return {"status": status, "to": to_email} if status == "sent" else None


# ── 1. Registration Email ────────────────────────────────────────────────────

def send_registration_email(to_email: str, first_name: str, matric_number: str,
                            user_id: int = None, session_id: int = None):
    """Welcome email on student registration."""
    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Registration<br>Successful</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            You're so close to starting your hostel journey, <strong>{first_name}</strong>. Your account has been created for the current academic session with matric number <strong>{matric_number}</strong>.
        </p>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 35px 0;">
            To finish setting up, just click the button below to log in and begin your hostel application.
        </p>
        <a href="{HMS_APP_URL}/login" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">Log in to my dashboard</a>
    """
    return _send(
        to_email, "Welcome to FUOYE Hostel Portal — Registration Successful",
        _wrap_html("Welcome", body),
        email_type="registration",
        recipient_name=first_name,
        recipient_matric=matric_number,
        recipient_user_id=user_id,
        session_id=session_id,
    )


# ── 1b. Student Invite Email (sent at import, before sign-up) ────────────────

def send_student_invite_email(to_email: str, first_name: str, matric_number: str,
                              session_name: str, session_id: int = None):
    """
    Invitation email sent when a student is imported into the session register.
    Notifies them they are verified and provides a direct link to the sign-up page.
    """
    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">You're<br>Verified! 🎉</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Hi <strong>{first_name}</strong>, your enrollment for the <strong>{session_name}</strong> academic session has been confirmed by the Student Affairs Unit.
        </p>
        <div style="background-color: #f9f9f9; padding: 24px; border-radius: 16px; margin: 0 0 25px 0; text-align: left;">
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Your Matric Number</p>
            <p style="margin: 0; font-size: 22px; font-weight: 900; color: #111827; letter-spacing: 0.5px;">{matric_number}</p>
        </div>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 35px 0;">
            You can now create your hostel portal account. Click the button below to proceed to the sign-up page — your matric number is your key.
        </p>
        <a href="{HMS_APP_URL}/register" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">Create my account</a>
        <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 30px 0 0 0;">
            If you were not expecting this email or believe this is an error, please contact the Student Affairs Unit immediately.
        </p>
    """
    return _send(
        to_email,
        f"FUOYE — You're a Verified Student. Create Your Hostel Account Now",
        _wrap_html("Student Invite", body),
        email_type="student_invite",
        recipient_name=first_name,
        recipient_matric=matric_number,
        session_id=session_id,
        extra_metadata={"session_name": session_name},
    )


# ── 2. Application Submitted Email ───────────────────────────────────────────

def send_application_submitted_email(to_email: str, first_name: str, matric_number: str,
                                     has_special_needs: bool, user_id: int = None, session_id: int = None):
    """Sent when a student submits their hostel application."""
    if has_special_needs:
        status_msg = """
            <p style="color: #92400E; background-color: #FEF3C7; padding: 16px; border-radius: 12px; font-size: 15px; line-height: 1.5; margin: 0 0 35px 0;">
                <strong>Note:</strong> Your medical documentation is now under administrative review. You will be notified within 3–5 working days.
            </p>
        """
    else:
        status_msg = """
            <p style="color: #166534; background-color: #DCFCE7; padding: 16px; border-radius: 12px; font-size: 15px; line-height: 1.5; margin: 0 0 35px 0;">
                <strong>Cleared!</strong> Your application is ready for the allocation process. You may now proceed to the compatibility quiz.
            </p>
        """

    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Application<br>Received</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Great news, <strong>{first_name}</strong>. Your hostel application has been received successfully and is safely in our system.
        </p>
        {status_msg}
        <a href="{HMS_APP_URL}/" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">View my dashboard</a>
    """
    return _send(
        to_email, "FUOYE — Application Received",
        _wrap_html("Application Submitted", body),
        email_type="application_submitted",
        recipient_name=first_name,
        recipient_matric=matric_number,
        recipient_user_id=user_id,
        session_id=session_id,
    )


# ── 3. Medical Review Email ──────────────────────────────────────────────────

def send_medical_review_email(to_email: str, first_name: str, status: str, notes: str = "",
                              attempts_remaining: int = 0, user_id: int = None, session_id: int = None):
    """Sent when admin approves or rejects medical documentation."""
    if status == "approved":
        subject = "FUOYE — Medical Documentation Approved ✓"
        status_block = """
            <p style="color: #166534; background-color: #DCFCE7; padding: 16px; border-radius: 12px; font-size: 15px; line-height: 1.5; margin: 0 0 35px 0;">
                <strong>Approved!</strong> Your medical documentation is verified and you are now cleared for hostel allocation.
            </p>
        """
        title = "Review<br>Approved"
    else:
        notes_html = f'<p style="margin: 10px 0 0 0; color: #991B1B;"><strong>Note:</strong> {notes}</p>' if notes else ""
        attempts_html = f'<p style="margin: 10px 0 0 0; color: #991B1B; font-size: 14px;">You have <strong>{attempts_remaining}</strong> attempt(s) remaining.</p>' if attempts_remaining > 0 else '<p style="margin: 10px 0 0 0; color: #991B1B; font-weight: bold;">You have exhausted all attempts. Please contact Admin.</p>'
        subject = "FUOYE — Medical Documentation Review Update"
        status_block = f"""
            <div style="color: #991B1B; background-color: #FEE2E2; padding: 16px; border-radius: 12px; font-size: 15px; line-height: 1.5; margin: 0 0 35px 0; text-align: left;">
                <strong>Action required:</strong> Unfortunately, your documentation could not be verified.
                {notes_html}
                {attempts_html}
            </div>
        """
        title = "Review<br>Update"

    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">{title}</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Hi <strong>{first_name}</strong>, we have an update regarding your recent medical documentation submission.
        </p>
        {status_block}
        <a href="{HMS_APP_URL}/apply" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">Check my status</a>
    """
    return _send(
        to_email, subject,
        _wrap_html("Medical Review", body),
        email_type="medical_review",
        recipient_name=first_name,
        recipient_user_id=user_id,
        session_id=session_id,
    )


# ── 4. Allocation Success Email ──────────────────────────────────────────────

def send_allocation_success_email(to_email: str, first_name: str, hostel: str, room: str, bed: int,
                                  matric: str = None, user_id: int = None, session_id: int = None):
    """Sent after a student is successfully allocated a bed space."""
    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Bed Space<br>Secured! 🎉</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Congratulations, <strong>{first_name}</strong>! We've successfully reserved a spot just for you.
        </p>
        <div style="background-color: #f9f9f9; padding: 24px; border-radius: 16px; margin: 0 0 35px 0;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Your Placement</p>
            <p style="margin: 0; font-size: 20px; font-weight: 800; color: #111827;">{hostel}</p>
            <p style="margin: 5px 0 0 0; font-size: 16px; color: #4b5563;">{room} • Bed {bed}</p>
        </div>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 35px 0;">
            The final step is to log in, view your invoice, and complete your payment to finalize the reservation.
        </p>
        <a href="{HMS_APP_URL}/payment" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">View my invoice</a>
    """
    return _send(
        to_email, "FUOYE — Bed Space Allocated!",
        _wrap_html("Allocation Confirmed", body),
        email_type="allocation_success",
        recipient_name=first_name,
        recipient_matric=matric,
        recipient_user_id=user_id,
        session_id=session_id,
    )


# ── 5. Invoice Generated Email ───────────────────────────────────────────────

def send_invoice_generated_email(to_email: str, first_name: str, total_naira: float, hms_ref: str,
                                 matric: str = None, user_id: int = None, session_id: int = None):
    """Sent when a payment invoice is ready for the student."""
    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Invoice<br>Ready</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Hi <strong>{first_name}</strong>, your hostel accommodation invoice has been generated.
        </p>
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 16px; margin: 0 0 35px 0;">
            <p style="margin: 0 0 5px 0; font-size: 14px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Total Due</p>
            <p style="margin: 0; font-size: 40px; font-weight: 900; color: #111827; letter-spacing: -1px;">₦{total_naira:,.2f}</p>
            <p style="margin: 10px 0 0 0; font-size: 13px; color: #6b7280;">Ref: {hms_ref}</p>
        </div>
        <a href="{HMS_APP_URL}/payment" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">Pay my invoice</a>
    """
    return _send(
        to_email, f"FUOYE — Invoice Ready (₦{total_naira:,.0f})",
        _wrap_html("Invoice", body),
        email_type="invoice",
        recipient_name=first_name,
        recipient_matric=matric,
        recipient_user_id=user_id,
        session_id=session_id,
    )


def send_payment_receipt_email(to_email: str, first_name: str, total_naira: float, hms_ref: str,
                               fee_type: str, matric: str = None, user_id: int = None, session_id: int = None):
    """Sent when a payment is successful."""
    fee_name = "Hostel Fee" if fee_type == "hostel" else "Application Fee"
    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Payment<br>Received</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Hi <strong>{first_name}</strong>, your {fee_name} payment was successful.
        </p>
        <div style="background-color: #f9f9f9; padding: 30px; border-radius: 16px; margin: 0 0 35px 0;">
            <p style="margin: 0 0 5px 0; font-size: 14px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Amount Paid</p>
            <p style="margin: 0; font-size: 40px; font-weight: 900; color: #111827; letter-spacing: -1px;">₦{total_naira:,.2f}</p>
            <p style="margin: 10px 0 0 0; font-size: 13px; color: #6b7280;">Ref: {hms_ref}</p>
        </div>
        <a href="{HMS_APP_URL}/receipt" style="background-color: #166534; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">View my receipt</a>
    """
    return _send(
        to_email, f"FUOYE — Payment Receipt (₦{total_naira:,.0f})",
        _wrap_html("Payment Receipt", body),
        email_type="payment_receipt",
        recipient_name=first_name,
        recipient_matric=matric,
        recipient_user_id=user_id,
        session_id=session_id,
    )


# ── 6. Password Reset Email ──────────────────────────────────────────────────

def send_password_reset_email(to_email: str, first_name: str, reset_token: str):
    """Sent when a user requests a password reset."""
    reset_url = f"{HMS_APP_URL}/reset-password?token={reset_token}"

    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Reset your<br>password</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 35px 0;">
            Hi <strong>{first_name}</strong>, we received a request to reset your FUOYE Hostel Portal password. Click the button below to create a new one. This link will expire in 15 minutes.
        </p>
        <a href="{reset_url}" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px; margin-bottom: 35px;">Reset my password</a>
        <p style="color: #9ca3af; font-size: 14px; line-height: 1.5; margin: 0;">
            If you didn't ask to reset your password, you can safely ignore this email.
        </p>
    """
    return _send(
        to_email, "FUOYE — Password Reset Request",
        _wrap_html("Password Reset", body),
        email_type="password_reset",
    )


# ── 7. Application Status Change Email ───────────────────────────────────────

def send_status_change_email(to_email: str, first_name: str, matric: str,
                             old_status: str, new_status: str, admin_note: str = "",
                             user_id: int = None, session_id: int = None):
    """Sent when admin changes a student's application status on the App Tracker."""
    status_labels = {
        "draft": "Draft",
        "submitted": "Submitted",
        "pending_verification": "Pending Verification",
        "medical_approved": "Medical Approved",
        "medical_rejected": "Medical Rejected",
        "ready_for_allocation": "Ready for Allocation",
        "allocated": "Allocated",
        "paid": "Paid",
        "cancelled": "Cancelled",
    }
    old_label = status_labels.get(old_status, old_status)
    new_label = status_labels.get(new_status, new_status)

    note_html = ""
    if admin_note:
        note_html = f"""
            <div style="background-color: #f9f9f9; padding: 16px; border-radius: 12px; margin: 0 0 35px 0; text-align: left;">
                <p style="margin: 0; font-size: 14px; color: #4b5563;"><strong>Note:</strong> {admin_note}</p>
            </div>
        """

    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Status<br>Updated</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Hi <strong>{first_name}</strong>, your application status has been changed from <em>{old_label}</em> to <strong>{new_label}</strong>.
        </p>
        {note_html}
        <a href="{HMS_APP_URL}/" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">View my dashboard</a>
    """
    return _send(
        to_email, f"FUOYE — Application Status Updated to {new_label}",
        _wrap_html("Status Update", body),
        email_type="status_change",
        recipient_name=first_name,
        recipient_matric=matric,
        recipient_user_id=user_id,
        session_id=session_id,
        extra_metadata={"old_status": old_status, "new_status": new_status, "note": admin_note},
    )


# ── 8. Allocation Revoked Email ──────────────────────────────────────────────

REVOCATION_REASON_LABELS = {
    "leaving_school": "Student Leaving the Institution",
    "suspension": "Academic Suspension",
    "disciplinary": "Disciplinary Action",
    "medical": "Medical Reasons",
    "transfer": "Transfer to Another Institution",
    "admin_override": "Administrative Decision",
    "other": "Other",
}


def send_allocation_revoked_email(to_email: str, first_name: str, matric: str,
                                  hostel: str, room: str, bed: int,
                                  reason: str, notes: str = "",
                                  user_id: int = None, session_id: int = None):
    """Sent when a student's allocation is revoked by admin."""
    reason_label = REVOCATION_REASON_LABELS.get(reason, reason)

    notes_html = ""
    if notes:
        notes_html = f"""
            <p style="margin: 10px 0 0 0; font-size: 14px; color: #991B1B;"><strong>Details:</strong> {notes}</p>
        """

    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Allocation<br>Revoked</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Hi <strong>{first_name}</strong>, we regret to inform you that your hostel bed allocation has been revoked.
        </p>
        <div style="background-color: #FEE2E2; padding: 24px; border-radius: 16px; margin: 0 0 35px 0; text-align: left;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #991B1B; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">{reason_label}</p>
            <p style="margin: 0; font-size: 16px; font-weight: 800; color: #991B1B;">{hostel}</p>
            <p style="margin: 5px 0 0 0; font-size: 15px; color: #991B1B;">{room} • Bed {bed}</p>
            {notes_html}
        </div>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 35px 0;">
            If you believe this is an error, please reach out to the Student Affairs Unit immediately.
        </p>
        <a href="{HMS_APP_URL}/" style="background-color: #f97316; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">View my dashboard</a>
    """
    return _send(
        to_email, "FUOYE — Allocation Revoked",
        _wrap_html("Allocation Revoked", body),
        email_type="allocation_revoked",
        recipient_name=first_name,
        recipient_matric=matric,
        recipient_user_id=user_id,
        session_id=session_id,
        extra_metadata={"reason": reason, "notes": notes, "hostel": hostel, "room": room, "bed": bed},
    )


def send_admin_assigned_email(to_email: str, first_name: str, identifier: str,
                              user_id: int = None, session_id: int = None):
    """Sent when a user is assigned as an administrator."""
    body = f"""
        <h1 style="color: #111827; font-size: 32px; font-weight: 800; margin: 0 0 20px 0; line-height: 1.2;">Admin Access<br>Granted</h1>
        <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            Hi <strong>{first_name}</strong>, you have been assigned as an administrator on the FUOYE Hostel Management Portal.
        </p>
        <div style="background-color: #ECFDF5; padding: 24px; border-radius: 16px; margin: 0 0 35px 0; text-align: left;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #047857; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Account Details</p>
            <p style="margin: 0; font-size: 16px; font-weight: 800; color: #047857;">Admin ID: {identifier}</p>
            <p style="margin: 5px 0 0 0; font-size: 15px; color: #047857;">Email: {to_email}</p>
        </div>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 35px 0;">
            You can now log in to the portal and manage sessions, student allocations, and hostel infrastructure.
        </p>
        <a href="{HMS_APP_URL}/login" style="background-color: #10b981; color: #ffffff; padding: 16px 32px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block; font-size: 16px;">Go to Admin Portal</a>
    """
    return _send(
        to_email, "FUOYE Hostel Portal — Admin Access Granted",
        _wrap_html("Admin Access Granted", body),
        email_type="admin_assigned",
        recipient_name=first_name,
        recipient_matric=identifier,
        recipient_user_id=user_id,
        session_id=session_id,
    )