"""
Admin Router — For managing hostels, blocks, rooms, beds, sessions, allocations,
               eligibility, and checkouts.
"""
import os
from fastapi import APIRouter, HTTPException, Depends
from models import (
    HostelCreate, HostelStatusUpdate,
    BlockCreate, BlockStatusUpdate,
    BulkRoomGenerate
)
from database import get_cursor, get_connection
from dependencies import get_current_admin
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class SessionCreate(BaseModel):
    session_name: str


class AdminCheckoutRequest(BaseModel):
    checkout_type: str = Field(..., pattern="^(admin_revocation|graduation|withdrawal)$")
    reason: Optional[str] = None


# ════════════════════════════════════════════════════════════
# SESSIONS
# ════════════════════════════════════════════════════════════

@router.post("/sessions")
def create_session(data: SessionCreate, admin=Depends(get_current_admin)):
    """Create a new academic session. Expires all allocations from old session first."""
    expired_count = 0
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Find current active session
            cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
            old_session = cur.fetchone()

            if old_session:
                old_session_id = old_session[0]
                # Expire all active allocations (creates checkout records, frees beds)
                cur.execute("SELECT expire_session_allocations(%s)", (old_session_id,))
                expired_count = cur.fetchone()[0]

                # Deactivate old session
                cur.execute(
                    "UPDATE academic_sessions SET is_active = FALSE, allocation_portal_open = FALSE, eligibility_portal_open = FALSE WHERE id = %s",
                    (old_session_id,),
                )

            cur.execute(
                "INSERT INTO academic_sessions (session_name, is_active, allocation_portal_open, eligibility_portal_open) VALUES (%s, TRUE, FALSE, FALSE) RETURNING id",
                (data.session_name,),
            )
            session_id = cur.fetchone()[0]
            conn.commit()

    msg = f"Session '{data.session_name}' created and set as active."
    if expired_count > 0:
        msg += f" {expired_count} allocation(s) from previous session expired."
    return {"message": msg, "session_id": session_id, "expired_count": expired_count}


@router.get("/sessions")
def list_sessions(admin=Depends(get_current_admin)):
    """List all academic sessions."""
    with get_cursor() as cur:
        cur.execute("SELECT id, session_name, is_active, allocation_portal_open, eligibility_portal_open FROM academic_sessions ORDER BY id DESC")
        rows = cur.fetchall()
    return [
        {"id": r[0], "session_name": r[1], "is_active": r[2], "portal_open": r[3], "eligibility_portal_open": r[4]}
        for r in rows
    ]


@router.patch("/session/toggle")
def toggle_allocation_portal(admin=Depends(get_current_admin)):
    """Opens or closes the FCFS allocation portal."""
    with get_cursor() as cur:
        cur.execute("SELECT id, allocation_portal_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        session = cur.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="No active session found. Create one first.")

        new_state = not session[1]
        cur.execute("UPDATE academic_sessions SET allocation_portal_open = %s WHERE id = %s", (new_state, session[0]))

    state_str = "OPENED" if new_state else "CLOSED"
    return {"message": f"The hostel allocation portal has been {state_str} for the current session", "portal_open": new_state}


@router.patch("/session/toggle-eligibility")
def toggle_eligibility_portal(admin=Depends(get_current_admin)):
    """Opens or closes the eligibility verification portal."""
    with get_cursor() as cur:
        cur.execute("SELECT id, eligibility_portal_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        session = cur.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="No active session found. Create one first.")

        new_state = not session[1]
        cur.execute("UPDATE academic_sessions SET eligibility_portal_open = %s WHERE id = %s", (new_state, session[0]))

    state_str = "OPENED" if new_state else "CLOSED"
    return {"message": f"The eligibility verification portal has been {state_str}", "eligibility_portal_open": new_state}


@router.get("/session/status")
def get_session_status(admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("SELECT id, session_name, is_active, allocation_portal_open, eligibility_portal_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        session = cur.fetchone()
        if not session:
            return {"status": "none"}

    return {
        "status": "active",
        "id": session[0],
        "name": session[1],
        "portal_open": session[3],
        "eligibility_portal_open": session[4],
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
                AND a.status = 'active'
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
    """Toggle a hostel's operational status (active / maintenance / decommissioned)."""
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
    """Toggle a block's status (active / maintenance)."""
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
    """Bulk generate rooms and beds within a BLOCK."""
    num_rooms    = max(4, min(data.num_rooms, 50))
    beds_per_room = max(1, min(data.beds_per_room, 8))
    created_rooms = 0
    created_beds  = 0

    with get_connection() as conn:
        with conn.cursor() as cur:
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
# ROOM-LEVEL ACCOUNTABILITY
# ════════════════════════════════════════════════════════════

@router.get("/rooms/{room_id}/students")
def get_room_students(room_id: int, admin=Depends(get_current_admin)):
    """Get a detailed list of all students allocated to a specific room."""
    with get_cursor() as cur:
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

        cur.execute("SELECT COUNT(*) FROM beds WHERE room_id = %s", (room_id,))
        total_beds = cur.fetchone()[0]

        cur.execute("""
            SELECT u.id, u.identifier, u.surname || ' ' || u.first_name AS full_name,
                   u.gender, u.department, u.level,
                   b.bed_number, a.payment_status, a.payment_deadline
            FROM allocations a
            JOIN users u               ON u.id = a.student_id
            JOIN beds b                ON b.id = a.bed_id
            JOIN academic_sessions s   ON s.id = a.session_id
            WHERE b.room_id = %s AND s.is_active = TRUE AND a.status = 'active'
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
                "identifier": s[1],
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
            WHERE s.is_active = TRUE AND a.status = 'active'
        """)
        occupied_beds = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*) FROM allocations a
            JOIN academic_sessions s ON s.id = a.session_id
            WHERE s.is_active = TRUE AND a.payment_status = 'pending' AND a.status = 'active'
        """)
        pending_payment = cur.fetchone()[0]

        # Eligible students (eligible but not allocated)
        cur.execute("""
            SELECT COUNT(*) FROM eligibility_status es
            JOIN academic_sessions s ON s.id = es.session_id
            WHERE s.is_active = TRUE AND es.is_eligible = TRUE
              AND NOT EXISTS (
                  SELECT 1 FROM allocations a
                  WHERE a.student_id = es.student_id AND a.session_id = es.session_id AND a.status = 'active'
              )
        """)
        eligible_count = cur.fetchone()[0]

        # Checkout count for current session
        cur.execute("""
            SELECT COUNT(*) FROM checkouts c
            JOIN academic_sessions s ON s.id = c.session_id
            WHERE s.is_active = TRUE
        """)
        checkout_count = cur.fetchone()[0]

    return {
        "total_students": total_students,
        "total_hostels": total_hostels,
        "total_blocks": total_blocks,
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "available_beds": total_beds - occupied_beds,
        "pending_payment_count": pending_payment,
        "active_allocations": occupied_beds,
        "eligible_count": eligible_count,
        "checkout_count": checkout_count,
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
                AND a.status = 'active'
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
# ELIGIBLE STUDENTS
# ════════════════════════════════════════════════════════════

@router.get("/eligible-students")
def list_eligible_students(admin=Depends(get_current_admin)):
    """List students who are eligible but not yet allocated for the current session."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT u.id, u.identifier, u.surname || ' ' || u.first_name AS full_name,
                   u.gender, u.department, u.level, es.eligible_at
            FROM eligibility_status es
            JOIN users u ON u.id = es.student_id
            JOIN academic_sessions s ON s.id = es.session_id
            WHERE s.is_active = TRUE AND es.is_eligible = TRUE
              AND NOT EXISTS (
                  SELECT 1 FROM allocations a
                  WHERE a.student_id = es.student_id AND a.session_id = es.session_id AND a.status = 'active'
              )
            ORDER BY es.eligible_at DESC
        """)
        rows = cur.fetchall()

    return [
        {
            "id": r[0],
            "identifier": r[1],
            "full_name": r[2],
            "gender": r[3],
            "department": r[4],
            "level": r[5],
            "eligible_at": r[6].isoformat() if r[6] else None,
        }
        for r in rows
    ]


# ════════════════════════════════════════════════════════════
# STUDENT DOCUMENTS (eligibility audit)
# ════════════════════════════════════════════════════════════

@router.get("/students/{student_id}/documents")
def get_student_documents(student_id: int, admin=Depends(get_current_admin)):
    """Return all eligibility documents uploaded by a student for the active session."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT ed.document_type, ed.ai_verdict, ed.rejection_reason,
                   ed.extracted_identifier, ed.uploaded_at, ed.verified_at, ed.file_path
            FROM eligibility_documents ed
            JOIN academic_sessions s ON s.id = ed.session_id AND s.is_active = TRUE
            WHERE ed.student_id = %s
            ORDER BY ed.uploaded_at DESC
        """, (student_id,))
        rows = cur.fetchall()

    doc_labels = {
        "acceptance_fee": "Acceptance Fee Receipt",
        "e_screening":    "E-Screening Receipt",
        "school_fees":    "School Fees Receipt",
    }

    return [
        {
            "document_type": r[0],
            "label": doc_labels.get(r[0], r[0]),
            "ai_verdict": r[1],
            "rejection_reason": r[2],
            "extracted_identifier": r[3],
            "uploaded_at": r[4].isoformat() if r[4] else None,
            "verified_at": r[5].isoformat() if r[5] else None,
            "file_name": os.path.basename(r[6]) if r[6] else None,
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
            SELECT a.id, a.student_id, u.identifier, u.surname || ' ' || u.first_name AS full_name,
                   h.name AS hostel_name, bl.name AS block_name, r.room_number, b.bed_number,
                   a.payment_status, a.payment_deadline, a.allocated_at
            FROM allocations a
            JOIN users u             ON u.id  = a.student_id
            JOIN beds b              ON b.id  = a.bed_id
            JOIN rooms r             ON r.id  = b.room_id
            JOIN blocks bl           ON bl.id = r.block_id
            JOIN hostels h           ON h.id  = bl.hostel_id
            JOIN academic_sessions s ON s.id  = a.session_id
            WHERE s.is_active = TRUE AND a.status = 'active'
            ORDER BY a.allocated_at DESC
        """)
        rows = cur.fetchall()

    return [
        {
            "id": r[0],
            "student_id": r[1],
            "identifier": r[2],
            "full_name": r[3],
            "hostel_name": r[4],
            "block_name": r[5],
            "room_number": r[6],
            "bed_number": r[7],
            "payment_status": r[8],
            "payment_deadline": r[9].isoformat() if r[9] else None,
            "allocated_at": r[10].isoformat() if r[10] else None,
        }
        for r in rows
    ]


@router.delete("/allocations/{allocation_id}")
def revoke_allocation(allocation_id: int, admin=Depends(get_current_admin)):
    """Manually revoke a student's allocation, free the bed, and record the checkout."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Get full allocation info for checkout record
            cur.execute("""
                SELECT a.student_id, a.bed_id, a.session_id,
                       h.name, bl.name, r.room_number, b.bed_number
                FROM allocations a
                JOIN beds b    ON b.id  = a.bed_id
                JOIN rooms r   ON r.id  = b.room_id
                JOIN blocks bl ON bl.id = r.block_id
                JOIN hostels h ON h.id  = bl.hostel_id
                WHERE a.id = %s
            """, (allocation_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Allocation not found")

            student_id, bed_id, session_id, hostel_name, block_name, room_number, bed_number = row

            # Record checkout
            admin_name = admin["identifier"]
            cur.execute("""
                INSERT INTO checkouts (student_id, session_id, bed_id, hostel_name, block_name, room_number, bed_number, checkout_type, reason, recorded_by, recorded_by_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'admin_revocation', 'Revoked by admin', %s, %s)
            """, (student_id, session_id, bed_id, hostel_name, block_name, room_number, bed_number,
                  admin["user_id"], admin_name))

            # Mark allocation as checked out (instead of deleting, preserve history)
            cur.execute("UPDATE allocations SET status = 'checked_out' WHERE id = %s", (allocation_id,))
            cur.execute("UPDATE beds SET status = 'vacant' WHERE id = %s", (bed_id,))
            conn.commit()

    return {"message": "Allocation revoked successfully. Bed has been freed."}


@router.post("/checkout/{student_id}")
def admin_checkout_student(student_id: int, data: AdminCheckoutRequest, admin=Depends(get_current_admin)):
    """Admin-initiated checkout (graduation, withdrawal, etc.)."""
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
        raise HTTPException(status_code=404, detail="Student does not have an active allocation.")

    alloc_id, bed_id, session_id, hostel_name, block_name, room_number, bed_number = row
    reason = data.reason or f"Admin checkout: {data.checkout_type}"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO checkouts (student_id, session_id, bed_id, hostel_name, block_name, room_number, bed_number, checkout_type, reason, recorded_by, recorded_by_name)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (student_id, session_id, bed_id, hostel_name, block_name, room_number, bed_number,
                  data.checkout_type, reason, admin["user_id"], admin["identifier"]))

            cur.execute("UPDATE allocations SET status = 'checked_out' WHERE id = %s", (alloc_id,))
            cur.execute("UPDATE beds SET status = 'vacant' WHERE id = %s", (bed_id,))
            conn.commit()

    return {"message": f"Student checked out ({data.checkout_type}). Bed freed."}


# ════════════════════════════════════════════════════════════
# CHECKOUT HISTORY
# ════════════════════════════════════════════════════════════

@router.get("/checkouts")
def list_checkouts(admin=Depends(get_current_admin)):
    """List checkout history for the current session."""
    with get_cursor() as cur:
        cur.execute("""
            SELECT c.id, u.identifier, u.surname || ' ' || u.first_name AS full_name,
                   c.hostel_name, c.block_name, c.room_number, c.bed_number,
                   c.checkout_type, c.reason, c.recorded_by_name, c.checked_out_at
            FROM checkouts c
            JOIN users u ON u.id = c.student_id
            JOIN academic_sessions s ON s.id = c.session_id
            WHERE s.is_active = TRUE
            ORDER BY c.checked_out_at DESC
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
            "checkout_type": r[7],
            "reason": r[8],
            "recorded_by": r[9],
            "checked_out_at": r[10].isoformat() if r[10] else None,
        }
        for r in rows
    ]


@router.post("/revoke-expired")
def revoke_expired_allocations(admin=Depends(get_current_admin)):
    """Revoke all allocations where the 7-day payment window has expired."""
    with get_connection() as conn:
        with conn.cursor() as cur:
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
                  AND a.status = 'active'
            """)
            expired = cur.fetchall()

            for alloc_id, bed_id, student_id, session_id, hostel_name, block_name, room_number, bed_number in expired:
                cur.execute("""
                    INSERT INTO checkouts (student_id, session_id, bed_id, hostel_name, block_name, room_number, bed_number, checkout_type, reason, recorded_by_name)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'payment_expired', 'Payment deadline expired', 'SYSTEM')
                """, (student_id, session_id, bed_id, hostel_name, block_name, room_number, bed_number))

                cur.execute("UPDATE allocations SET status = 'expired' WHERE id = %s", (alloc_id,))
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


# ════════════════════════════════════════════════════════════
# HOSTEL PRICES
# ════════════════════════════════════════════════════════════

VALID_PROGRAM_TYPES = {"ND_FT", "ND_PT", "HND_FT", "HND_PT"}


@router.get("/hostels/{hostel_id}/prices")
def get_hostel_prices(hostel_id: int, admin=Depends(get_current_admin)):
    """Get all program-type prices for a hostel."""
    with get_cursor() as cur:
        cur.execute("SELECT name FROM hostels WHERE id = %s", (hostel_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Hostel not found")

        cur.execute(
            "SELECT program_type, amount FROM hostel_prices WHERE hostel_id = %s ORDER BY program_type",
            (hostel_id,),
        )
        rows = cur.fetchall()

    return [{"program_type": r[0], "amount": r[1]} for r in rows]


@router.put("/hostels/{hostel_id}/prices")
def update_hostel_prices(hostel_id: int, body: dict, admin=Depends(get_current_admin)):
    """
    Set prices for a hostel. Expects {"prices": [{"program_type": "ND_FT", "amount": 15000}, ...]}.
    Uses UPSERT — existing prices are updated, new ones inserted.
    """
    prices = body.get("prices", [])
    if not prices:
        raise HTTPException(status_code=400, detail="No prices provided")

    with get_cursor() as cur:
        cur.execute("SELECT name FROM hostels WHERE id = %s", (hostel_id,))
        hostel = cur.fetchone()
        if not hostel:
            raise HTTPException(status_code=404, detail="Hostel not found")

    updated = 0
    with get_cursor() as cur:
        for p in prices:
            pt = p.get("program_type", "").strip().upper()
            amount = p.get("amount")

            if pt not in VALID_PROGRAM_TYPES:
                continue
            if not isinstance(amount, (int, float)) or amount < 0:
                continue

            cur.execute("""
                INSERT INTO hostel_prices (hostel_id, program_type, amount)
                VALUES (%s, %s, %s)
                ON CONFLICT (hostel_id, program_type)
                DO UPDATE SET amount = EXCLUDED.amount
            """, (hostel_id, pt, int(amount)))
            updated += 1

    return {"message": f"Updated {updated} price(s) for '{hostel[0]}'"}


# ════════════════════════════════════════════════════════════
# TRANSACTIONS
# ════════════════════════════════════════════════════════════

@router.get("/transactions")
def list_transactions(status: Optional[str] = None, admin=Depends(get_current_admin)):
    """List all payment transactions with student info and hostel choices."""
    query = """
        SELECT pp.id, pp.student_id, u.identifier,
               u.surname || ' ' || u.first_name AS full_name,
               pp.paystack_reference, pp.amount_kobo, pp.status,
               h1.name AS choice_1, h2.name AS choice_2, h3.name AS choice_3,
               pp.created_at, pp.completed_at, pp.session_id,
               s.session_name
        FROM pending_payments pp
        JOIN users u ON u.id = pp.student_id
        LEFT JOIN hostels h1 ON h1.id = pp.choice_1_id
        LEFT JOIN hostels h2 ON h2.id = pp.choice_2_id
        LEFT JOIN hostels h3 ON h3.id = pp.choice_3_id
        LEFT JOIN academic_sessions s ON s.id = pp.session_id
    """
    params = []

    if status and status in ("pending", "completed", "failed"):
        query += " WHERE pp.status = %s"
        params.append(status)

    query += " ORDER BY pp.created_at DESC LIMIT 500"

    with get_cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    return [
        {
            "id": r[0],
            "student_id": r[1],
            "identifier": r[2],
            "full_name": r[3],
            "reference": r[4],
            "amount": r[5] // 100 if r[5] else 0,
            "status": r[6],
            "choice_1": r[7],
            "choice_2": r[8],
            "choice_3": r[9],
            "created_at": r[10].isoformat() if r[10] else None,
            "completed_at": r[11].isoformat() if r[11] else None,
            "session_name": r[13],
        }
        for r in rows
    ]
