"""
Background Tasks — Automated hostel management rules.

12-Factor Compliant (Factor VI):
  This module is designed to be run as a STANDALONE one-off process,
  NOT inside the web server. Execute via:
    python -m scripts.revoke_expired

  The web process must remain stateless and share-nothing.
"""
import logging
from database import get_connection

logger = logging.getLogger(__name__)


def revoke_expired_allocations():
    """
    Checks active academic sessions. If the hostel_fee_deadline has passed,
    it revokes any active allocations for students who have NOT paid the hostel fee.
    """
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                # Get active session with passed hostel fee deadline
                cur.execute("""
                    SELECT id, hostel_fee_deadline FROM academic_sessions
                    WHERE is_active = TRUE AND hostel_fee_deadline IS NOT NULL
                      AND hostel_fee_deadline < NOW()
                """)
                sess = cur.fetchone()
                if not sess:
                    logger.info("AUTO-REVOKE: No active session with an expired hostel fee deadline.")
                    return

                session_id = sess[0]

                # Find active allocations without confirmed hostel fee payment
                cur.execute("""
                    SELECT a.id, a.bed_id, a.student_id 
                    FROM allocations a
                    WHERE a.session_id = %s AND a.status = 'active'
                      AND NOT EXISTS (
                          SELECT 1 FROM confirmed_payments cp
                          JOIN payment_component_log pcl ON pcl.payment_id = cp.id
                          JOIN fee_components fc ON fc.id = pcl.component_id
                          WHERE cp.student_id = a.student_id AND cp.session_id = %s
                            AND cp.status = 'confirmed' AND fc.fee_type = 'hostel'
                      )
                """, (session_id, session_id))
                
                expired_allocations = cur.fetchall()
                
                if not expired_allocations:
                    logger.info("AUTO-REVOKE: No unpaid allocations found past the deadline.")
                    return
                
                # Revoke them
                logger.info("AUTO-REVOKE: Found %d expired allocations to revoke for session %s.", len(expired_allocations), session_id)
                
                for alloc_id, bed_id, student_id in expired_allocations:
                    # 1. Update allocation status
                    cur.execute("""
                        UPDATE allocations
                        SET status = 'revoked', revocation_reason = 'Hostel fee deadline passed',
                            revoked_by = 'SYSTEM', revoked_at = NOW()
                        WHERE id = %s
                    """, (alloc_id,))
                    
                    # 2. Free up the bed
                    cur.execute("UPDATE beds SET status = 'vacant' WHERE id = %s", (bed_id,))
                    
                    # 3. Update application status
                    cur.execute("""
                        UPDATE hostel_applications
                        SET status = 'ready_for_allocation'
                        WHERE student_id = %s AND session_id = %s
                    """, (student_id, session_id))
                    
                    # 4. Audit Log
                    cur.execute("""
                        INSERT INTO audit_logs (actor_type, actor_id, action_type, target_entity, target_id, description, session_id)
                        VALUES ('system', 'SYSTEM', 'REVOKE_ALLOCATION', 'allocation', %s, 'Auto-revoked due to missed hostel fee deadline', %s)
                    """, (str(alloc_id), session_id))
                
                conn.commit()
                logger.info("AUTO-REVOKE: Successfully auto-revoked %d allocations.", len(expired_allocations))

    except Exception as e:
        logger.error("AUTO-REVOKE failed: %s", e, exc_info=True)


if __name__ == "__main__":
    from logging_config import setup_logging
    setup_logging()
    revoke_expired_allocations()
