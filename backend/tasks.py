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
      - status = 'active'

    Also records checkout entries for each revoked allocation.
    """
    while True:
        try:
            with get_connection() as conn:
                with conn.cursor() as cur:
                    # Find expired allocations with full details for checkout records
                    cur.execute("""
                        SELECT a.id, a.bed_id, a.student_id, a.session_id,
                               h.name, bl.name, r.room_number, b.bed_number
                        FROM allocations a
                        JOIN beds b    ON b.id  = a.bed_id
                        JOIN rooms r   ON r.id  = b.room_id
                        JOIN blocks bl ON bl.id = r.block_id
                        JOIN hostels h ON h.id  = bl.hostel_id
                        WHERE a.payment_status = 'pending'
                          AND a.payment_deadline IS NOT NULL
                          AND a.payment_deadline < CURRENT_TIMESTAMP
                          AND (a.status = 'active' OR a.status IS NULL)
                    """)
                    expired = cur.fetchall()

                    if expired:
                        for alloc_id, bed_id, student_id, session_id, hostel_name, block_name, room_number, bed_number in expired:
                            # Record checkout
                            cur.execute("""
                                INSERT INTO checkouts (student_id, session_id, bed_id, hostel_name, block_name, room_number, bed_number, checkout_type, reason, recorded_by_name)
                                VALUES (%s, %s, %s, %s, %s, %s, %s, 'payment_expired', 'Payment deadline expired (auto-revocation)', 'SYSTEM')
                            """, (student_id, session_id, bed_id, hostel_name, block_name, room_number, bed_number))

                            cur.execute("UPDATE allocations SET status = 'expired' WHERE id = %s", (alloc_id,))
                            cur.execute("UPDATE beds SET status = 'vacant' WHERE id = %s", (bed_id,))

                        conn.commit()
                        print(f"[AUTO-REVOKE] Freed {len(expired)} bed(s) from expired allocations.")
                    else:
                        print("[AUTO-REVOKE] Checked. No expired allocations found.")

        except Exception as e:
            print(f"[AUTO-REVOKE ERROR] {e}")

        # Check every hour
        await asyncio.sleep(3600)
