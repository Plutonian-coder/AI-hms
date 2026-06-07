"""
Audit Logger — Fire-and-forget INSERT into audit_logs.

Centralised logging for all system events.
Never raises exceptions — logging failures must not block the main operation.

12-Factor Compliant:
  - Factor XI: Uses structured logging instead of traceback.print_exc()
"""
import json
import logging
from database import get_cursor

logger = logging.getLogger(__name__)

# ── Action Type Constants ────────────────────────────────────────────────────
STUDENT_REGISTERED    = "STUDENT_REGISTERED"
STUDENT_LOGIN         = "STUDENT_LOGIN"
PROFILE_UPDATED       = "PROFILE_UPDATED"
PASSWORD_CHANGED      = "PASSWORD_CHANGED"
APPLICATION_SUBMITTED = "APPLICATION_SUBMITTED"
PAYMENT_INITIALIZED   = "PAYMENT_INITIALIZED"
PAYMENT_CONFIRMED     = "PAYMENT_CONFIRMED"
PAYMENT_FAILED        = "PAYMENT_FAILED"
RECEIPT_GENERATED     = "RECEIPT_GENERATED"
QUIZ_SUBMITTED        = "QUIZ_SUBMITTED"
BED_ALLOCATED         = "BED_ALLOCATED"
ALLOCATION_REVOKED    = "ALLOCATION_REVOKED"
SESSION_CREATED       = "SESSION_CREATED"
SESSION_ACTIVATED     = "SESSION_ACTIVATED"
SESSION_ENDED         = "SESSION_ENDED"
PORTAL_TOGGLED        = "PORTAL_TOGGLED"
FEE_COMPONENT_ADDED   = "FEE_COMPONENT_ADDED"
FEE_COMPONENT_UPDATED = "FEE_COMPONENT_UPDATED"
REGISTER_IMPORTED     = "REGISTER_IMPORTED"
HOSTEL_CREATED        = "HOSTEL_CREATED"
HOSTEL_DELETED        = "HOSTEL_DELETED"
REPORT_GENERATED      = "REPORT_GENERATED"
ADMIN_NL_QUERY        = "ADMIN_NL_QUERY"

# Pipeline-specific constants
MEDICAL_DOC_UPLOADED       = "MEDICAL_DOC_UPLOADED"
MEDICAL_REVIEW_APPROVED    = "MEDICAL_REVIEW_APPROVED"
MEDICAL_REVIEW_REJECTED    = "MEDICAL_REVIEW_REJECTED"
APPLICATION_STAGE_ADVANCED = "APPLICATION_STAGE_ADVANCED"
ADMIN_STATUS_UPDATE        = "ADMIN_STATUS_UPDATE"
EMAIL_SENT                 = "EMAIL_SENT"


def log_event(
    action_type: str,
    actor_type: str,
    actor_id: str,
    description: str,
    target_entity: str = None,
    target_id: str = None,
    metadata: dict = None,
    session_id: int = None,
):
    """
    Insert an audit log record. Fire-and-forget — never raises.

    Args:
        action_type: One of the action type constants above
        actor_type: 'student', 'admin', 'system', or 'paystack'
        actor_id: matric number, admin ID, 'SYSTEM', or 'PAYSTACK_WEBHOOK'
        description: Human-readable event description
        target_entity: Affected entity type (allocation, payment, user, session, etc.)
        target_id: ID of the affected record
        metadata: Additional context as dict (stored as JSONB)
        session_id: Academic session context
    """
    try:
        with get_cursor() as cur:
            cur.execute(
                """INSERT INTO audit_logs
                   (actor_type, actor_id, action_type, target_entity, target_id,
                    description, metadata, session_id)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    actor_type,
                    str(actor_id),
                    action_type,
                    target_entity,
                    str(target_id) if target_id is not None else None,
                    description,
                    json.dumps(metadata) if metadata else "{}",
                    session_id,
                ),
            )
    except Exception:
        # Never crash the calling code — log to stdout for container capture
        logger.error("Failed to write audit log: action=%s actor=%s", action_type, actor_id, exc_info=True)
