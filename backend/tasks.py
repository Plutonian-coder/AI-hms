"""
Background Tasks — Scheduled jobs for automated hostel management rules.
Currently runs an hourly 7-day payment revocation check per Yabatech policy.

Usage: imported in main.py and started via FastAPI startup event.
"""
import asyncio
from database import get_connection


async def auto_revoke_expired_allocations():
    """
    Runs every hour. Revokes any allocation where:
      - payment_status = 'pending'  (student not yet validated payment)
      - payment_deadline < NOW      (7-day window has passed)

    Per institutional policy (yabatech_hostel_research.md):
    'Payments made after the one-week window are declared null and void.'
    """
    while True:
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    # Find expired allocations
                    cur.execute("""
                        SELECT id, bed_id FROM allocations
                        WHERE payment_status = 'pending'
                          AND payment_deadline IS NOT NULL
                          AND payment_deadline < CURRENT_TIMESTAMP
                    """)
                    expired = cur.fetchall()

                    if expired:
                        for alloc_id, bed_id in expired:
                            cur.execute("DELETE FROM allocations WHERE id = %s", (alloc_id,))
                            cur.execute("UPDATE beds SET status = 'vacant' WHERE id = %s", (bed_id,))

                        conn.commit()
                        print(f"[AUTO-REVOKE] Freed {len(expired)} bed(s) from expired allocations.")
                    else:
                        print("[AUTO-REVOKE] Checked. No expired allocations found.")

        except Exception as e:
            print(f"[AUTO-REVOKE ERROR] {e}")

        # Check every hour
        await asyncio.sleep(3600)
