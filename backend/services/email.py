"""
Email Service — Rita from HMS

All lifecycle emails for the Hostel Management System.
Uses Gmail SMTP for reliable delivery to any email address.
Sender persona: "Rita from HMS" — warm but professional.

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

from config import SMTP_EMAIL, SMTP_APP_PASSWORD, HMS_APP_URL

logger = logging.getLogger(__name__)

SENDER_NAME = "Rita from HMS"

# ── Shared HTML wrapper ──────────────────────────────────────────────────────

def _wrap_html(title, body_html):
    """Wraps email body in a branded HMS HTML template."""
    return f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
        <div style="background-color: #0f3d24; padding: 30px 20px; text-align: center;">
            <h2 style="color: #ecfccb; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">HMS PORTAL</h2>
            <p style="color: rgba(236, 252, 203, 0.6); margin: 4px 0 0 0; font-size: 12px; font-weight: 600;">{title}</p>
        </div>
        <div style="padding: 30px 24px; color: #374151; line-height: 1.7;">
            {body_html}
        </div>
        <div style="background-color: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">This is an automated message from {SENDER_NAME}. Please do not reply directly.</p>
            <p style="margin: 4px 0 0 0; font-size: 11px; color: #d1d5db;">Hostel Management System &bull; Student Affairs Unit</p>
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
            actor_id="HMS_MAILER",
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
    """Send an email via Gmail SMTP and log it. Never raises — logs errors."""
    if not SMTP_EMAIL or not SMTP_APP_PASSWORD:
        logger.warning("SMTP not configured (SMTP_EMAIL / SMTP_APP_PASSWORD missing). Email to %s skipped.", to_email)
        return None

    status = "sent"
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{SENDER_NAME} <{SMTP_EMAIL}>"
        msg["To"] = to_email

        # Plain text fallback
        plain_text = f"This email requires an HTML-capable client. Visit {HMS_APP_URL} for more information."
        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html, "html"))

        # Connect to Gmail SMTP with TLS
        context = ssl.create_default_context()
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
            server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())

        logger.info("Email sent to %s. Subject: %s", to_email, subject)
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
        <h3 style="color: #111827; margin-top: 0;">Registration Successful</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS. Your account has been successfully created on the Hostel Management System for the current academic session.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0f3d24;">
            <p style="margin: 0;"><strong>Matriculation Number:</strong> {matric_number}</p>
        </div>
        <p>You can now log in to your dashboard to begin your hostel application.</p>
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/login" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">Log In to Your Dashboard</a>
        </div>
        <p style="font-size: 14px; color: #6b7280;">If you experience any issues, please reach out to the Student Affairs Unit.</p>
    """
    return _send(
        to_email, "Welcome to HMS Portal — Registration Successful",
        _wrap_html("Welcome", body),
        email_type="registration",
        recipient_name=first_name,
        recipient_matric=matric_number,
        recipient_user_id=user_id,
        session_id=session_id,
    )


# ── 2. Application Submitted Email ───────────────────────────────────────────

def send_application_submitted_email(to_email: str, first_name: str, matric_number: str,
                                     has_special_needs: bool, user_id: int = None, session_id: int = None):
    """Sent when a student submits their hostel application."""
    if has_special_needs:
        status_msg = """
            <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #92400E;">
                <p style="margin: 0; color: #92400E; font-weight: 600;">Your medical documentation is now under administrative review. You will be notified within 3–5 working days.</p>
            </div>
        """
    else:
        status_msg = """
            <div style="background-color: #DCFCE7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #166534;">
                <p style="margin: 0; color: #166534; font-weight: 600;">Your application is cleared and ready for the allocation process. You may now proceed to the compatibility quiz.</p>
            </div>
        """

    body = f"""
        <h3 style="color: #111827; margin-top: 0;">Application Received</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS. Your hostel application has been received successfully.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0f3d24;">
            <p style="margin: 0;"><strong>Matric Number:</strong> {matric_number}</p>
        </div>
        {status_msg}
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">View Your Dashboard</a>
        </div>
    """
    return _send(
        to_email, "HMS — Application Received",
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
        subject = "HMS — Medical Documentation Approved ✓"
        status_block = """
            <div style="background-color: #DCFCE7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #166534;">
                <p style="margin: 0; color: #166534; font-weight: 600;">Great news! Your medical documentation has been approved. You are now cleared for hostel allocation.</p>
            </div>
        """
    else:
        notes_html = f'<p style="margin: 8px 0 0 0; color: #92400E;"><strong>Admin notes:</strong> {notes}</p>' if notes else ""
        attempts_html = f'<p style="margin: 4px 0 0 0; color: #92400E; font-size: 13px;">You have <strong>{attempts_remaining}</strong> re-upload attempt(s) remaining.</p>' if attempts_remaining > 0 else '<p style="margin: 4px 0 0 0; color: #991B1B; font-size: 13px; font-weight: 600;">You have exhausted all upload attempts. Please contact the Student Affairs Unit.</p>'
        subject = "HMS — Medical Documentation Review Update"
        status_block = f"""
            <div style="background-color: #FEE2E2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #991B1B;">
                <p style="margin: 0; color: #991B1B; font-weight: 600;">Unfortunately, your documentation could not be verified.</p>
                {notes_html}
                {attempts_html}
            </div>
        """

    body = f"""
        <h3 style="color: #111827; margin-top: 0;">Medical Review Update</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS with an update on your medical documentation review.</p>
        {status_block}
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/apply" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">View Application Status</a>
        </div>
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
        <h3 style="color: #111827; margin-top: 0;">Bed Space Secured! 🎉</h3>
        <p>Dear {first_name},</p>
        <p>Congratulations! A bed space has been secured for you.</p>
        <div style="background-color: #DCFCE7; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #BBF7D0;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Hostel</td><td style="padding: 6px 0; text-align: right; font-weight: 700; color: #111827;">{hostel}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Room</td><td style="padding: 6px 0; text-align: right; font-weight: 700; color: #111827;">{room}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Bed</td><td style="padding: 6px 0; text-align: right; font-weight: 700; color: #111827;">Bed {bed}</td></tr>
            </table>
        </div>
        <p>Please log in to view your invoice and complete payment.</p>
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/payment" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">View Invoice &amp; Pay</a>
        </div>
    """
    return _send(
        to_email, "HMS — Bed Space Allocated!",
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
        <h3 style="color: #111827; margin-top: 0;">Invoice Ready</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS. Your hostel accommodation invoice is now ready.</p>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Total Amount</p>
            <p style="margin: 4px 0 0 0; font-size: 32px; font-weight: 900; color: #0f3d24;">₦{total_naira:,.2f}</p>
            <p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">Reference: {hms_ref}</p>
        </div>
        <p>Please log in to review the itemized breakdown and complete payment.</p>
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/payment" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">Review &amp; Pay</a>
        </div>
    """
    return _send(
        to_email, f"HMS — Invoice Ready (₦{total_naira:,.0f})",
        _wrap_html("Invoice", body),
        email_type="invoice",
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
        <h3 style="color: #111827; margin-top: 0;">Password Reset Request</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS. We received a request to reset your password on the Hostel Management System.</p>
        <p>Click the button below to set a new password. This link will <strong>expire in 15 minutes</strong>.</p>
        <div style="text-align: center; margin: 35px 0;">
            <a href="{reset_url}" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">Reset My Password</a>
        </div>
        <div style="background-color: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #92400E;">
            <p style="margin: 0; color: #92400E; font-weight: 600; font-size: 13px;">If you did not request this reset, please ignore this email. Your password will remain unchanged.</p>
        </div>
        <p style="font-size: 13px; color: #6b7280;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="font-size: 12px; color: #9ca3af; word-break: break-all;">{reset_url}</p>
    """
    return _send(
        to_email, "HMS — Password Reset Request",
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
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #6b7280;">
                <p style="margin: 0; font-size: 13px; color: #374151;"><strong>Admin Note:</strong> {admin_note}</p>
            </div>
        """

    body = f"""
        <h3 style="color: #111827; margin-top: 0;">Application Status Updated</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS. Your hostel application status has been updated by an administrator.</p>
        <div style="background-color: #EFF6FF; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #BFDBFE;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Previous Status</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #6b7280;">{old_label}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; color: #1D4ED8; font-size: 13px; font-weight: 600;">New Status</td>
                    <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #1D4ED8;">{new_label}</td>
                </tr>
            </table>
        </div>
        {note_html}
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">View Your Dashboard</a>
        </div>
    """
    return _send(
        to_email, f"HMS — Application Status Updated to {new_label}",
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
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #6b7280;">
                <p style="margin: 0; font-size: 13px; color: #374151;"><strong>Details:</strong> {notes}</p>
            </div>
        """

    body = f"""
        <h3 style="color: #111827; margin-top: 0;">Allocation Revoked</h3>
        <p>Dear {first_name},</p>
        <p>This is Rita from HMS. We regret to inform you that your hostel bed allocation has been revoked.</p>
        <div style="background-color: #FEE2E2; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #FECACA;">
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Hostel</td><td style="padding: 6px 0; text-align: right; font-weight: 700; color: #111827;">{hostel}</td></tr>
                <tr><td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Room / Bed</td><td style="padding: 6px 0; text-align: right; font-weight: 700; color: #111827;">{room} / Bed {bed}</td></tr>
                <tr><td style="padding: 6px 0; color: #991B1B; font-size: 13px; font-weight: 600;">Reason</td><td style="padding: 6px 0; text-align: right; font-weight: 700; color: #991B1B;">{reason_label}</td></tr>
            </table>
        </div>
        {notes_html}
        <p style="font-size: 14px; color: #6b7280;">If you believe this is an error, please contact the Student Affairs Unit immediately.</p>
        <div style="text-align: center; margin: 35px 0;">
            <a href="{HMS_APP_URL}/" style="background-color: #84cc16; color: #0f3d24; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 50px; display: inline-block;">View Your Dashboard</a>
        </div>
    """
    return _send(
        to_email, "HMS — Allocation Revoked",
        _wrap_html("Allocation Revoked", body),
        email_type="allocation_revoked",
        recipient_name=first_name,
        recipient_matric=matric,
        recipient_user_id=user_id,
        session_id=session_id,
        extra_metadata={"reason": reason, "notes": notes, "hostel": hostel, "room": room, "bed": bed},
    )