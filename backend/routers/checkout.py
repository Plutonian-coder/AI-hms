"""
Checkout Router — Student voluntary checkout and departure tracking.
"""
from fastapi import APIRouter, Depends, HTTPException
from database import get_cursor, get_connection
from dependencies import get_current_student

router = APIRouter(prefix="/api/v1/checkout", tags=["checkout"])


@router.post("/voluntary")
def voluntary_checkout(student=Depends(get_current_student)):
    """
    Student-initiated voluntary checkout from their hostel.
    Frees the bed and records the departure.
    """
    student_id = student["user_id"]

    # Find active allocation
    with get_cursor() as cur:
        cur.execute("""
            SELECT a.id, a.bed_id, a.session_id,
                   h.name, bl.name, r.room_number, b.bed_number
            FROM allocations a
            JOIN academic_sessions sess ON sess.id = a.session_id AND sess.is_active = TRUE
            JOIN beds b    ON b.id  = a.bed_id
            JOIN rooms r   ON r.id  = b.room_id
            JOIN blocks bl ON bl.id = r.block_id
            JOIN hostels h ON h.id  = bl.hostel_id
            WHERE a.student_id = %s AND a.status = 'active'
        """, (student_id,))
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="You don't have an active allocation to check out from.")

    alloc_id, bed_id, session_id, hostel_name, block_name, room_number, bed_number = row

    # Perform checkout in a transaction
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Record the checkout
            cur.execute("""
                INSERT INTO checkouts (student_id, session_id, bed_id, hostel_name, block_name, room_number, bed_number, checkout_type, reason, recorded_by_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'voluntary', 'Student voluntarily checked out', %s)
            """, (student_id, session_id, bed_id, hostel_name, block_name, room_number, bed_number,
                  f"{student['identifier']}"))

            # Mark allocation as checked out
            cur.execute("UPDATE allocations SET status = 'checked_out' WHERE id = %s", (alloc_id,))

            # Free the bed
            cur.execute("UPDATE beds SET status = 'vacant' WHERE id = %s", (bed_id,))
            conn.commit()

    return {
        "message": "Successfully checked out",
        "hostel": hostel_name,
        "room": room_number,
        "bed": bed_number,
    }
