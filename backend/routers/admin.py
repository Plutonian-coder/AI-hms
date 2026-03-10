"""
Admin Router — For managing hostels, blocks, rooms, beds, sessions, and allocations.
"""
from fastapi import APIRouter, HTTPException, Depends
from models import (
    HostelCreate, HostelStatusUpdate,
    BlockCreate, BlockStatusUpdate,
    BulkRoomGenerate
)
from database import get_cursor, get_connection
from dependencies import get_current_admin
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class SessionCreate(BaseModel):
    session_name: str


# ════════════════════════════════════════════════════════════
# SESSIONS
# ════════════════════════════════════════════════════════════

@router.post("/sessions")
def create_session(data: SessionCreate, admin=Depends(get_current_admin)):
    """Create a new academic session. Deactivates any currently active session first."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE academic_sessions SET is_active = FALSE, allocation_portal_open = FALSE WHERE is_active = TRUE")
            cur.execute(
                "INSERT INTO academic_sessions (session_name, is_active, allocation_portal_open) VALUES (%s, TRUE, FALSE) RETURNING id",
                (data.session_name,)
            )
            session_id = cur.fetchone()[0]
            conn.commit()
    return {"message": f"Session '{data.session_name}' created and set as active", "session_id": session_id}


@router.get("/sessions")
def list_sessions(admin=Depends(get_current_admin)):
    """List all academic sessions."""
    with get_cursor() as cur:
        cur.execute("SELECT id, session_name, is_active, allocation_portal_open FROM academic_sessions ORDER BY id DESC")
        rows = cur.fetchall()
    return [
        {"id": r[0], "session_name": r[1], "is_active": r[2], "portal_open": r[3]}
        for r in rows
    ]


@router.patch("/session/toggle")
def toggle_allocation_portal(admin=Depends(get_current_admin)):
    """Opens or closes the FCFS portal."""
    with get_cursor() as cur:
        cur.execute("SELECT id, allocation_portal_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        session = cur.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="No active session found. Create one first.")

        new_state = not session[1]
        cur.execute("UPDATE academic_sessions SET allocation_portal_open = %s WHERE id = %s", (new_state, session[0]))

    state_str = "OPENED" if new_state else "CLOSED"
    return {"message": f"The hostel allocation portal has been {state_str} for the current session", "portal_open": new_state}


@router.get("/session/status")
def get_session_status(admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("SELECT id, session_name, is_active, allocation_portal_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        session = cur.fetchone()
        if not session:
            return {"status": "none"}

    return {
        "status": "active",
        "id": session[0],
        "name": session[1],
        "portal_open": session[3]
    }


# ════════════════════════════════════════════════════════════
# HOSTELS
# ════════════════════════════════════════════════════════════

@router.post("/hostels")
def create_hostel(data: HostelCreate, admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute(
            "INSERT INTO hostels (name, gender_restriction, status) VALUES (%s, %s, %s) RETURNING id",
            (data.name, data.gender_restriction, data.status)
        )
        hostel_id = cur.fetchone()[0]
    return {"message": "Hostel created", "hostel_id": hostel_id}


@router.get("/hostels")
def list_hostels(admin=Depends(get_current_admin)):
    """List all hostels with block count, capacity, and occupancy."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT h.id, h.name, h.gender_restriction, h.status, h.capacity,
                   COUNT(DISTINCT bl.id) AS block_count,
                   COUNT(a.id)           AS occupied
            FROM hostels h
            LEFT JOIN blocks bl ON bl.hostel_id = h.id
            LEFT JOIN rooms r   ON r.block_id = bl.id
            LEFT JOIN beds b    ON b.room_id = r.id
            LEFT JOIN allocations a ON a.bed_id = b.id
                AND a.session_id = (SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1)
            GROUP BY h.id
            ORDER BY h.name
        """)
        rows = cur.fetchall()

    return [
        {
            "id": r[0], "name": r[1], "gender": r[2], "status": r[3],
            "capacity": r[4], "block_count": r[5], "occupied": r[6],
            "available": r[4] - r[6]
        }
        for r in rows
    ]


@router.patch("/hostels/{hostel_id}/status")
def update_hostel_status(hostel_id: int, data: HostelStatusUpdate, admin=Depends(get_current_admin)):
    """Toggle a hostel's operational status (active / maintenance / decommissioned).
    Maintenance hostels are excluded from student allocation choices."""
    with get_cursor() as cur:
        cur.execute(
            "UPDATE hostels SET status = %s WHERE id = %s RETURNING name",
            (data.status, hostel_id)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Hostel not found")
    return {"message": f"'{row[0]}' status updated to '{data.status}'"}


# ════════════════════════════════════════════════════════════
# BLOCKS
# ════════════════════════════════════════════════════════════

@router.post("/blocks")
def create_block(data: BlockCreate, admin=Depends(get_current_admin)):
    """Create a new block within a hostel. Block names must be unique per hostel."""
    with get_cursor() as cur:
        cur.execute("SELECT name FROM hostels WHERE id = %s", (data.hostel_id,))
        hostel = cur.fetchone()
        if not hostel:
            raise HTTPException(status_code=404, detail="Hostel not found")

        cur.execute(
            "INSERT INTO blocks (hostel_id, name) VALUES (%s, %s) RETURNING id",
            (data.hostel_id, data.name.strip())
        )
        block_id = cur.fetchone()[0]
    return {"message": f"Block '{data.name}' created in {hostel[0]}", "block_id": block_id}


@router.get("/hostels/{hostel_id}/blocks")
def list_blocks(hostel_id: int, admin=Depends(get_current_admin)):
    """List all blocks for a hostel, with room counts and occupancy."""
    with get_cursor() as cur:
        # Verify hostel exists
        cur.execute("SELECT name FROM hostels WHERE id = %s", (hostel_id,))
        hostel = cur.fetchone()
        if not hostel:
            raise HTTPException(status_code=404, detail="Hostel not found")

        cur.execute("""
            SELECT bl.id, bl.name, bl.status,
                   COUNT(DISTINCT r.id)                                                     AS room_count,
                   COUNT(DISTINCT b.id)                                                     AS total_beds,
                   COUNT(DISTINCT CASE WHEN b.status = 'occupied' THEN b.id END)            AS occupied_beds
            FROM blocks bl
            LEFT JOIN rooms r ON r.block_id = bl.id
            LEFT JOIN beds  b ON b.room_id  = r.id
            WHERE bl.hostel_id = %s
            GROUP BY bl.id
            ORDER BY bl.name
        """, (hostel_id,))
        rows = cur.fetchall()

    return {
        "hostel_name": hostel[0],
        "blocks": [
            {
                "id": r[0], "name": r[1], "status": r[2],
                "room_count": r[3], "total_beds": r[4], "occupied_beds": r[5],
                "available_beds": r[4] - r[5]
            }
            for r in rows
        ]
    }


@router.patch("/blocks/{block_id}/status")
def update_block_status(block_id: int, data: BlockStatusUpdate, admin=Depends(get_current_admin)):
    """Toggle a block's status (active / maintenance). Maintenance blocks are excluded from allocations."""
    with get_cursor() as cur:
        cur.execute(
            "UPDATE blocks SET status = %s WHERE id = %s RETURNING name",
            (data.status, block_id)
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Block not found")
    return {"message": f"Block '{row[0]}' status updated to '{data.status}'"}


# ════════════════════════════════════════════════════════════
# ROOMS & BEDS (block-aware, capped generation)
# ════════════════════════════════════════════════════════════

@router.post("/blocks/{block_id}/rooms")
def create_many_rooms_and_beds(
    block_id: int,
    data: BulkRoomGenerate,
    admin=Depends(get_current_admin)
):
    """Bulk generate rooms and beds within a BLOCK (supervisor requirement).
    Hard caps: minimum 4 rooms, maximum 50 rooms per call, maximum 8 beds per room.
    Room numbering continues from the last existing room in the block."""
    # Enforce caps (Pydantic already validates these via ge/le, but defense-in-depth)
    num_rooms    = max(4, min(data.num_rooms, 50))
    beds_per_room = max(1, min(data.beds_per_room, 8))
    created_rooms = 0
    created_beds  = 0

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Verify block exists and get parent hostel info
            cur.execute("""
                SELECT bl.id, bl.name, bl.hostel_id, h.name, h.capacity
                FROM blocks bl
                JOIN hostels h ON h.id = bl.hostel_id
                WHERE bl.id = %s
            """, (block_id,))
            block = cur.fetchone()
            if not block:
                raise HTTPException(status_code=404, detail="Block not found")

            _, block_name, hostel_id, hostel_name, current_capacity = block

            # Continue room numbering after existing rooms in this block
            cur.execute("SELECT COUNT(*) FROM rooms WHERE block_id = %s", (block_id,))
            existing_count = cur.fetchone()[0]

            for i in range(1, num_rooms + 1):
                room_number = f"R{existing_count + i:03d}"
                cur.execute(
                    "INSERT INTO rooms (block_id, room_number) VALUES (%s, %s) RETURNING id",
                    (block_id, room_number)
                )
                room_id = cur.fetchone()[0]
                created_rooms += 1

                for bed_idx in range(1, beds_per_room + 1):
                    cur.execute(
                        "INSERT INTO beds (room_id, bed_number) VALUES (%s, %s)",
                        (room_id, bed_idx)
                    )
                    created_beds += 1

            # Update hostel's total capacity
            new_capacity = current_capacity + created_beds
            cur.execute("UPDATE hostels SET capacity = %s WHERE id = %s", (new_capacity, hostel_id))
            conn.commit()

    return {
        "message": f"Added {created_rooms} rooms ({created_beds} beds) to {hostel_name} / {block_name}",
        "hostel_name": hostel_name,
        "block_name": block_name,
        "rooms_created": created_rooms,
        "beds_created": created_beds,
        "new_hostel_capacity": new_capacity
    }


@router.get("/blocks/{block_id}/rooms")
def list_block_rooms(block_id: int, admin=Depends(get_current_admin)):
    """List all rooms within a block, with bed counts and occupancy."""
    with get_cursor() as cur:
        cur.execute("SELECT name FROM blocks WHERE id = %s", (block_id,))
        block = cur.fetchone()
        if not block:
            raise HTTPException(status_code=404, detail="Block not found")

        cur.execute("""
            SELECT r.id, r.room_number, r.status,
                   COUNT(b.id)                                              AS total_beds,
                   COUNT(CASE WHEN b.status = 'occupied' THEN 1 END)       AS occupied_beds
            FROM rooms r
            LEFT JOIN beds b ON b.room_id = r.id
            WHERE r.block_id = %s
            GROUP BY r.id
            ORDER BY r.room_number
        """, (block_id,))
        rows = cur.fetchall()

    return {
        "block_name": block[0],
        "rooms": [
            {
                "id": r[0], "room_number": r[1], "status": r[2],
                "total_beds": r[3], "occupied_beds": r[4],
                "available_beds": r[3] - r[4]
            }
            for r in rows
        ]
    }


# ════════════════════════════════════════════════════════════
# ROOM-LEVEL ACCOUNTABILITY (supervisor requirement #3)
# ════════════════════════════════════════════════════════════

@router.get("/rooms/{room_id}/students")
def get_room_students(room_id: int, admin=Depends(get_current_admin)):
    """Get a detailed list of all students allocated to a specific room.
    Includes names, matric numbers, departments, levels, bed numbers, and payment status."""
    with get_cursor() as cur:
        # Room metadata
        cur.execute("""
            SELECT r.room_number, r.status, bl.name AS block_name, h.name AS hostel_name, h.id
            FROM rooms r
            JOIN blocks  bl ON bl.id       = r.block_id
            JOIN hostels h  ON h.id        = bl.hostel_id
            WHERE r.id = %s
        """, (room_id,))
        room_meta = cur.fetchone()
        if not room_meta:
            raise HTTPException(status_code=404, detail="Room not found")

        room_number, room_status, block_name, hostel_name, hostel_id = room_meta

        # Total beds in room
        cur.execute("SELECT COUNT(*) FROM beds WHERE room_id = %s", (room_id,))
        total_beds = cur.fetchone()[0]

        # All students currently allocated to this room in the active session
        cur.execute("""
            SELECT u.id, u.identifier, u.surname || ' ' || u.first_name AS full_name,
                   u.gender, u.department, u.level,
                   b.bed_number, a.payment_status, a.payment_deadline
            FROM allocations a
            JOIN users u               ON u.id = a.student_id
            JOIN beds b                ON b.id = a.bed_id
            JOIN academic_sessions s   ON s.id = a.session_id
            WHERE b.room_id = %s AND s.is_active = TRUE
            ORDER BY b.bed_number
        """, (room_id,))
        students = cur.fetchall()

    return {
        "room_id": room_id,
        "room_number": room_number,
        "room_status": room_status,
        "block_name": block_name,
        "hostel_name": hostel_name,
        "total_beds": total_beds,
        "occupied_beds": len(students),
        "vacant_beds": total_beds - len(students),
        "students": [
            {
                "student_id": s[0],
                "identifier": s[1],        # Matric number
                "full_name": s[2],
                "gender": s[3],
                "department": s[4],
                "level": s[5],
                "bed_number": s[6],
                "payment_status": s[7],
                "payment_deadline": s[8].isoformat() if s[8] else None,
            }
            for s in students
        ]
    }


# ════════════════════════════════════════════════════════════
# STATS
# ════════════════════════════════════════════════════════════

@router.get("/stats")
def get_admin_stats(admin=Depends(get_current_admin)):
    """Get overview stats for the admin dashboard."""
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM users WHERE role = 'student'")
        total_students = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM hostels")
        total_hostels = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM blocks")
        total_blocks = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM beds")
        total_beds = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*) FROM allocations a
            JOIN academic_sessions s ON s.id = a.session_id
            WHERE s.is_active = TRUE
        """)
        occupied_beds = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*) FROM allocations a
            JOIN academic_sessions s ON s.id = a.session_id
            WHERE s.is_active = TRUE AND a.payment_status = 'pending'
        """)
        pending_payment = cur.fetchone()[0]

    return {
        "total_students": total_students,
        "total_hostels": total_hostels,
        "total_blocks": total_blocks,
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "available_beds": total_beds - occupied_beds,
        "pending_payment_count": pending_payment,
        "active_allocations": occupied_beds
    }


# ════════════════════════════════════════════════════════════
# STUDENTS
# ════════════════════════════════════════════════════════════

@router.get("/students")
def list_students(admin=Depends(get_current_admin)):
    """List all registered students with allocation status."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT u.id, u.identifier, u.surname, u.first_name, u.gender,
                   u.department, u.level,
                   CASE WHEN a.id IS NOT NULL THEN TRUE ELSE FALSE END AS is_allocated
            FROM users u
            LEFT JOIN allocations a ON a.student_id = u.id
                AND a.session_id = (SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1)
            WHERE u.role = 'student'
            ORDER BY u.surname, u.first_name
        """)
        rows = cur.fetchall()

    return [
        {
            "id": r[0],
            "identifier": r[1],
            "full_name": f"{r[2]} {r[3]}",
            "gender": r[4],
            "department": r[5],
            "level": r[6],
            "is_allocated": r[7],
        }
        for r in rows
    ]


# ════════════════════════════════════════════════════════════
# ALLOCATION MANAGEMENT
# ════════════════════════════════════════════════════════════

@router.get("/allocations")
def list_allocations(admin=Depends(get_current_admin)):
    """List all active allocations for the current session."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT a.id, u.identifier, u.surname || ' ' || u.first_name AS full_name,
                   h.name AS hostel_name, bl.name AS block_name, r.room_number, b.bed_number,
                   a.payment_status, a.payment_deadline, a.allocated_at
            FROM allocations a
            JOIN users u             ON u.id  = a.student_id
            JOIN beds b              ON b.id  = a.bed_id
            JOIN rooms r             ON r.id  = b.room_id
            JOIN blocks bl           ON bl.id = r.block_id
            JOIN hostels h           ON h.id  = bl.hostel_id
            JOIN academic_sessions s ON s.id  = a.session_id
            WHERE s.is_active = TRUE
            ORDER BY a.allocated_at DESC
        """)
        rows = cur.fetchall()

    return [
        {
            "id": r[0],
            "identifier": r[1],
            "full_name": r[2],
            "hostel_name": r[3],
            "block_name": r[4],
            "room_number": r[5],
            "bed_number": r[6],
            "payment_status": r[7],
            "payment_deadline": r[8].isoformat() if r[8] else None,
            "allocated_at": r[9].isoformat() if r[9] else None,
        }
        for r in rows
    ]


@router.delete("/allocations/{allocation_id}")
def revoke_allocation(allocation_id: int, admin=Depends(get_current_admin)):
    """Manually revoke a student's allocation and free the bed."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT bed_id FROM allocations WHERE id = %s", (allocation_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Allocation not found")

            bed_id = row[0]
            cur.execute("DELETE FROM allocations WHERE id = %s", (allocation_id,))
            cur.execute("UPDATE beds SET status = 'vacant' WHERE id = %s", (bed_id,))
            conn.commit()

    return {"message": "Allocation revoked successfully. Bed has been freed."}


@router.post("/revoke-expired")
def revoke_expired_allocations(admin=Depends(get_current_admin)):
    """Revoke all allocations where the 7-day payment window has expired.
    Per institutional policy: payments not validated within 7 days are null and void."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, bed_id FROM allocations
                WHERE payment_status = 'pending'
                  AND payment_deadline IS NOT NULL
                  AND payment_deadline < CURRENT_TIMESTAMP
            """)
            expired = cur.fetchall()

            for alloc_id, bed_id in expired:
                cur.execute("DELETE FROM allocations WHERE id = %s", (alloc_id,))
                cur.execute("UPDATE beds SET status = 'vacant' WHERE id = %s", (bed_id,))

            conn.commit()

    return {
        "message": f"Revoked {len(expired)} expired allocation(s). Beds have been freed.",
        "revoked_count": len(expired)
    }


@router.get("/allocation-requests")
def list_allocation_requests(admin=Depends(get_current_admin)):
    """View the audit log of all allocation attempts."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT ar.id, u.identifier, u.surname || ' ' || u.first_name AS full_name,
                   ar.status, ar.rejection_reason, ar.extracted_rrr, ar.created_at
            FROM allocation_requests ar
            JOIN users u ON u.id = ar.student_id
            ORDER BY ar.created_at DESC
            LIMIT 200
        """)
        rows = cur.fetchall()

    return [
        {
            "id": r[0],
            "identifier": r[1],
            "full_name": r[2],
            "status": r[3],
            "rejection_reason": r[4],
            "rrr": r[5],
            "created_at": r[6].isoformat() if r[6] else None,
        }
        for r in rows
    ]
