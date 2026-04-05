"""
Admin Router — Session management, hostel infrastructure, fee components,
               student management, allocations, and audit trail.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from models import (
    HostelCreate, HostelStatusUpdate,
    BlockCreate, BlockStatusUpdate,
    BulkRoomGenerate, SessionCreate,
    FeeComponentCreate, FeeComponentUpdate,
)
from database import get_cursor, get_connection
from dependencies import get_current_admin
from services.audit_logger import (
    log_event, SESSION_CREATED, PORTAL_TOGGLED, SESSION_ENDED,
    FEE_COMPONENT_ADDED, FEE_COMPONENT_UPDATED, HOSTEL_CREATED,
    ALLOCATION_REVOKED, ADMIN_NL_QUERY,
)
from services.gemini_query import generate_sql, validate_sql
from typing import Optional

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


# ════════════════════════════════════════════════════════════
# SESSIONS
# ════════════════════════════════════════════════════════════

@router.post("/sessions")
def create_session(data: SessionCreate, admin=Depends(get_current_admin)):
    """Create a new academic session. Expires allocations from old session."""
    expired_count = 0
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
            old_session = cur.fetchone()

            if old_session:
                cur.execute("SELECT expire_session_allocations(%s)", (old_session[0],))
                expired_count = cur.fetchone()[0]
                cur.execute(
                    """UPDATE academic_sessions
                       SET is_active = FALSE, session_ended = TRUE,
                           application_portal_open = FALSE, payment_portal_open = FALSE,
                           allocation_portal_open = FALSE, register_import_open = FALSE
                       WHERE id = %s""",
                    (old_session[0],),
                )

            levels = data.eligible_levels or ["100L", "200L", "300L", "400L", "500L"]
            cur.execute(
                """INSERT INTO academic_sessions
                   (session_name, year_start, year_end, eligible_levels, is_active)
                   VALUES (%s, %s, %s, %s, TRUE) RETURNING id""",
                (data.session_name, data.year_start, data.year_end, levels),
            )
            session_id = cur.fetchone()[0]
            conn.commit()

    log_event(
        SESSION_CREATED, "admin", admin["identifier"],
        f"Created session '{data.session_name}'",
        target_entity="session", target_id=str(session_id),
        session_id=session_id,
    )

    msg = f"Session '{data.session_name}' created and set as active."
    if expired_count > 0:
        msg += f" {expired_count} allocation(s) from previous session expired."
    return {"message": msg, "session_id": session_id, "expired_count": expired_count}


@router.get("/sessions")
def list_sessions(admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute(
            """SELECT id, session_name, is_active, year_start, year_end,
                      eligible_levels, application_portal_open, payment_portal_open,
                      allocation_portal_open, register_import_open, session_ended
               FROM academic_sessions ORDER BY id DESC"""
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0], "session_name": r[1], "is_active": r[2],
            "year_start": r[3], "year_end": r[4],
            "eligible_levels": r[5] or [],
            "application_portal_open": r[6],
            "payment_portal_open": r[7],
            "allocation_portal_open": r[8],
            "register_import_open": r[9],
            "session_ended": r[10],
        }
        for r in rows
    ]


@router.patch("/session/toggle/{portal}")
def toggle_portal(portal: str, admin=Depends(get_current_admin)):
    """Toggle a portal. Valid portals: application, payment, allocation, register_import."""
    portal_map = {
        "application": "application_portal_open",
        "payment": "payment_portal_open",
        "allocation": "allocation_portal_open",
        "register_import": "register_import_open",
    }
    column = portal_map.get(portal)
    if not column:
        raise HTTPException(status_code=400, detail=f"Invalid portal: {portal}")

    with get_cursor() as cur:
        cur.execute(
            f"SELECT id, {column} FROM academic_sessions WHERE is_active = TRUE LIMIT 1"
        )
        session = cur.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="No active session")

        new_state = not session[1]
        cur.execute(
            f"UPDATE academic_sessions SET {column} = %s WHERE id = %s",
            (new_state, session[0]),
        )

    state_str = "OPENED" if new_state else "CLOSED"
    log_event(
        PORTAL_TOGGLED, "admin", admin["identifier"],
        f"{portal} portal {state_str}",
        target_entity="session", target_id=str(session[0]),
        metadata={"portal": portal, "new_state": new_state},
        session_id=session[0],
    )
    return {"message": f"{portal.replace('_', ' ').title()} portal has been {state_str}", portal: new_state}


@router.post("/session/end")
def end_session(admin=Depends(get_current_admin)):
    """End the active session — expires all allocations and closes all portals."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, session_name FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
            session = cur.fetchone()
            if not session:
                raise HTTPException(status_code=404, detail="No active session")

            cur.execute("SELECT expire_session_allocations(%s)", (session[0],))
            expired = cur.fetchone()[0]

            cur.execute(
                """UPDATE academic_sessions
                   SET session_ended = TRUE, is_active = FALSE,
                       application_portal_open = FALSE, payment_portal_open = FALSE,
                       allocation_portal_open = FALSE, register_import_open = FALSE
                   WHERE id = %s""",
                (session[0],),
            )
            conn.commit()

    log_event(
        SESSION_ENDED, "admin", admin["identifier"],
        f"Ended session '{session[1]}', expired {expired} allocations",
        target_entity="session", target_id=str(session[0]),
        session_id=session[0],
    )
    return {"message": f"Session '{session[1]}' ended. {expired} allocation(s) expired."}


@router.get("/session/status")
def get_session_status(admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute(
            """SELECT id, session_name, year_start, year_end,
                      application_portal_open, payment_portal_open,
                      allocation_portal_open, register_import_open
               FROM academic_sessions WHERE is_active = TRUE LIMIT 1"""
        )
        s = cur.fetchone()
        if not s:
            return {"status": "none"}

        # Count register imports
        cur.execute("SELECT COUNT(*) FROM session_register WHERE session_id = %s", (s[0],))
        register_count = cur.fetchone()[0]

    return {
        "status": "active",
        "id": s[0], "name": s[1],
        "year_start": s[2], "year_end": s[3],
        "application_portal_open": s[4],
        "payment_portal_open": s[5],
        "allocation_portal_open": s[6],
        "register_import_open": s[7],
        "register_count": register_count,
    }


# ════════════════════════════════════════════════════════════
# FEE COMPONENTS
# ════════════════════════════════════════════════════════════

@router.get("/fee-components")
def list_fee_components(admin=Depends(get_current_admin)):
    """List all fee components for the active session."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        session = cur.fetchone()
        if not session:
            return []

        cur.execute(
            """SELECT id, name, amount_fulltime, amount_parttime, amount_sandwich,
                      applies_to, is_mandatory, sort_order
               FROM fee_components WHERE session_id = %s ORDER BY sort_order, id""",
            (session[0],),
        )
        rows = cur.fetchall()

    return [
        {
            "id": r[0], "name": r[1],
            "amount_fulltime": r[2], "amount_parttime": r[3], "amount_sandwich": r[4],
            "applies_to": r[5], "is_mandatory": r[6], "sort_order": r[7],
        }
        for r in rows
    ]


@router.post("/fee-components")
def create_fee_component(data: FeeComponentCreate, admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        session = cur.fetchone()
        if not session:
            raise HTTPException(status_code=404, detail="No active session")

        cur.execute(
            """INSERT INTO fee_components
               (session_id, name, amount_fulltime, amount_parttime, amount_sandwich,
                applies_to, is_mandatory, sort_order)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (session[0], data.name, data.amount_fulltime, data.amount_parttime,
             data.amount_sandwich, data.applies_to, data.is_mandatory, data.sort_order),
        )
        comp_id = cur.fetchone()[0]

    log_event(
        FEE_COMPONENT_ADDED, "admin", admin["identifier"],
        f"Added fee component '{data.name}'",
        target_entity="fee_component", target_id=str(comp_id),
        session_id=session[0],
    )
    return {"message": f"Fee component '{data.name}' created", "id": comp_id}


@router.put("/fee-components/{comp_id}")
def update_fee_component(comp_id: int, data: FeeComponentUpdate, admin=Depends(get_current_admin)):
    updates = []
    params = []
    for field in ["name", "amount_fulltime", "amount_parttime", "amount_sandwich",
                   "applies_to", "is_mandatory", "sort_order"]:
        val = getattr(data, field, None)
        if val is not None:
            updates.append(f"{field} = %s")
            params.append(val)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    params.append(comp_id)
    with get_cursor() as cur:
        cur.execute(f"UPDATE fee_components SET {', '.join(updates)} WHERE id = %s RETURNING name", params)
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Fee component not found")

    log_event(
        FEE_COMPONENT_UPDATED, "admin", admin["identifier"],
        f"Updated fee component '{row[0]}'",
        target_entity="fee_component", target_id=str(comp_id),
    )
    return {"message": f"Fee component updated"}


@router.delete("/fee-components/{comp_id}")
def delete_fee_component(comp_id: int, admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("DELETE FROM fee_components WHERE id = %s RETURNING name", (comp_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Fee component not found")
    return {"message": f"Fee component '{row[0]}' deleted"}


# ════════════════════════════════════════════════════════════
# HOSTELS
# ════════════════════════════════════════════════════════════

@router.post("/hostels")
def create_hostel(data: HostelCreate, admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute(
            "INSERT INTO hostels (name, gender_restriction, status) VALUES (%s, %s, %s) RETURNING id",
            (data.name, data.gender_restriction, data.status),
        )
        hostel_id = cur.fetchone()[0]

    log_event(
        HOSTEL_CREATED, "admin", admin["identifier"],
        f"Created hostel '{data.name}'",
        target_entity="hostel", target_id=str(hostel_id),
    )
    return {"message": "Hostel created", "hostel_id": hostel_id}


@router.get("/hostels")
def list_hostels(admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("""
            SELECT h.id, h.name, h.gender_restriction, h.status, h.capacity,
                   COUNT(DISTINCT bl.id) AS block_count,
                   COUNT(CASE WHEN b.status = 'occupied' THEN 1 END) AS occupied
            FROM hostels h
            LEFT JOIN blocks bl ON bl.hostel_id = h.id
            LEFT JOIN rooms r   ON r.block_id = bl.id
            LEFT JOIN beds b    ON b.room_id = r.id
            GROUP BY h.id
            ORDER BY h.name
        """)
        rows = cur.fetchall()

    return [
        {
            "id": r[0], "name": r[1], "gender": r[2], "status": r[3],
            "capacity": r[4], "block_count": r[5], "occupied": r[6],
            "available": r[4] - r[6],
        }
        for r in rows
    ]


@router.patch("/hostels/{hostel_id}/status")
def update_hostel_status(hostel_id: int, data: HostelStatusUpdate, admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("UPDATE hostels SET status = %s WHERE id = %s RETURNING name", (data.status, hostel_id))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Hostel not found")
    return {"message": f"'{row[0]}' status updated to '{data.status}'"}


# ════════════════════════════════════════════════════════════
# BLOCKS
# ════════════════════════════════════════════════════════════

@router.post("/blocks")
def create_block(data: BlockCreate, admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("SELECT name FROM hostels WHERE id = %s", (data.hostel_id,))
        hostel = cur.fetchone()
        if not hostel:
            raise HTTPException(status_code=404, detail="Hostel not found")

        cur.execute(
            "INSERT INTO blocks (hostel_id, name) VALUES (%s, %s) RETURNING id",
            (data.hostel_id, data.name.strip()),
        )
        block_id = cur.fetchone()[0]
    return {"message": f"Block '{data.name}' created in {hostel[0]}", "block_id": block_id}


@router.get("/hostels/{hostel_id}/blocks")
def list_blocks(hostel_id: int, admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("SELECT name FROM hostels WHERE id = %s", (hostel_id,))
        hostel = cur.fetchone()
        if not hostel:
            raise HTTPException(status_code=404, detail="Hostel not found")

        cur.execute("""
            SELECT bl.id, bl.name, bl.status,
                   COUNT(DISTINCT r.id) AS room_count,
                   COUNT(DISTINCT b.id) AS total_beds,
                   COUNT(DISTINCT CASE WHEN b.status = 'occupied' THEN b.id END) AS occupied_beds
            FROM blocks bl
            LEFT JOIN rooms r ON r.block_id = bl.id
            LEFT JOIN beds  b ON b.room_id  = r.id
            WHERE bl.hostel_id = %s
            GROUP BY bl.id ORDER BY bl.name
        """, (hostel_id,))
        rows = cur.fetchall()

    return {
        "hostel_name": hostel[0],
        "blocks": [
            {
                "id": r[0], "name": r[1], "status": r[2],
                "room_count": r[3], "total_beds": r[4], "occupied_beds": r[5],
                "available_beds": r[4] - r[5],
            }
            for r in rows
        ],
    }


@router.patch("/blocks/{block_id}/status")
def update_block_status(block_id: int, data: BlockStatusUpdate, admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("UPDATE blocks SET status = %s WHERE id = %s RETURNING name", (data.status, block_id))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Block not found")
    return {"message": f"Block '{row[0]}' status updated to '{data.status}'"}


# ════════════════════════════════════════════════════════════
# ROOMS & BEDS
# ════════════════════════════════════════════════════════════

@router.post("/blocks/{block_id}/rooms")
def create_many_rooms_and_beds(block_id: int, data: BulkRoomGenerate, admin=Depends(get_current_admin)):
    num_rooms = max(4, min(data.num_rooms, 50))
    beds_per_room = max(1, min(data.beds_per_room, 8))
    created_rooms = 0
    created_beds = 0

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT bl.id, bl.name, bl.hostel_id, h.name, h.capacity
                FROM blocks bl JOIN hostels h ON h.id = bl.hostel_id
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
                    (block_id, room_number),
                )
                room_id = cur.fetchone()[0]
                created_rooms += 1

                for bed_idx in range(1, beds_per_room + 1):
                    cur.execute("INSERT INTO beds (room_id, bed_number) VALUES (%s, %s)", (room_id, bed_idx))
                    created_beds += 1

            new_capacity = current_capacity + created_beds
            cur.execute("UPDATE hostels SET capacity = %s WHERE id = %s", (new_capacity, hostel_id))
            conn.commit()

    return {
        "message": f"Added {created_rooms} rooms ({created_beds} beds) to {hostel_name} / {block_name}",
        "rooms_created": created_rooms,
        "beds_created": created_beds,
        "new_hostel_capacity": new_capacity,
    }


@router.get("/blocks/{block_id}/rooms")
def list_block_rooms(block_id: int, admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("SELECT name FROM blocks WHERE id = %s", (block_id,))
        block = cur.fetchone()
        if not block:
            raise HTTPException(status_code=404, detail="Block not found")

        cur.execute("""
            SELECT r.id, r.room_number, r.status,
                   COUNT(b.id) AS total_beds,
                   COUNT(CASE WHEN b.status = 'occupied' THEN 1 END) AS occupied_beds
            FROM rooms r
            LEFT JOIN beds b ON b.room_id = r.id
            WHERE r.block_id = %s
            GROUP BY r.id ORDER BY r.room_number
        """, (block_id,))
        rows = cur.fetchall()

    return {
        "block_name": block[0],
        "rooms": [
            {
                "id": r[0], "room_number": r[1], "status": r[2],
                "total_beds": r[3], "occupied_beds": r[4],
                "available_beds": r[3] - r[4],
            }
            for r in rows
        ],
    }


# ════════════════════════════════════════════════════════════
# ROOM STUDENTS
# ════════════════════════════════════════════════════════════

@router.get("/rooms/{room_id}/students")
def get_room_students(room_id: int, admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("""
            SELECT r.room_number, r.status, bl.name, h.name, h.id
            FROM rooms r
            JOIN blocks bl ON bl.id = r.block_id
            JOIN hostels h ON h.id = bl.hostel_id
            WHERE r.id = %s
        """, (room_id,))
        room_meta = cur.fetchone()
        if not room_meta:
            raise HTTPException(status_code=404, detail="Room not found")

        cur.execute("SELECT COUNT(*) FROM beds WHERE room_id = %s", (room_id,))
        total_beds = cur.fetchone()[0]

        cur.execute("""
            SELECT u.id, u.identifier, u.surname || ' ' || u.first_name,
                   u.gender, u.department, u.level, b.bed_number,
                   a.avg_compatibility_score
            FROM allocations a
            JOIN users u ON u.id = a.student_id
            JOIN beds b ON b.id = a.bed_id
            JOIN academic_sessions s ON s.id = a.session_id
            WHERE b.room_id = %s AND s.is_active = TRUE AND a.status = 'active'
            ORDER BY b.bed_number
        """, (room_id,))
        students = cur.fetchall()

    return {
        "room_id": room_id,
        "room_number": room_meta[0],
        "room_status": room_meta[1],
        "block_name": room_meta[2],
        "hostel_name": room_meta[3],
        "total_beds": total_beds,
        "occupied_beds": len(students),
        "vacant_beds": total_beds - len(students),
        "students": [
            {
                "student_id": s[0], "identifier": s[1], "full_name": s[2],
                "gender": s[3], "department": s[4], "level": s[5],
                "bed_number": s[6], "compatibility_score": float(s[7]) if s[7] else None,
            }
            for s in students
        ],
    }


# ════════════════════════════════════════════════════════════
# STATS
# ════════════════════════════════════════════════════════════

@router.get("/stats")
def get_admin_stats(admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        session = cur.fetchone()
        session_id = session[0] if session else None

        cur.execute("SELECT COUNT(*) FROM users WHERE role = 'student'")
        total_students = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM hostels")
        total_hostels = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM beds")
        total_beds = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM beds WHERE status = 'occupied'")
        occupied_beds = cur.fetchone()[0]

        # Applications for current session
        applications = 0
        if session_id:
            cur.execute("SELECT COUNT(*) FROM hostel_applications WHERE session_id = %s", (session_id,))
            applications = cur.fetchone()[0]

        # Active allocations for current session
        active_allocations = 0
        if session_id:
            cur.execute(
                "SELECT COUNT(*) FROM allocations WHERE session_id = %s AND status = 'active'",
                (session_id,),
            )
            active_allocations = cur.fetchone()[0]

        # Total revenue for current session
        revenue = 0
        if session_id:
            cur.execute(
                "SELECT COALESCE(SUM(total_amount_kobo), 0) FROM confirmed_payments WHERE session_id = %s AND status = 'confirmed'",
                (session_id,),
            )
            revenue = cur.fetchone()[0]

        # Unallocated students (have paid but not allocated)
        unallocated = 0
        if session_id:
            cur.execute("""
                SELECT COUNT(*) FROM confirmed_payments cp
                WHERE cp.session_id = %s AND cp.status = 'confirmed'
                  AND NOT EXISTS (
                      SELECT 1 FROM allocations a
                      WHERE a.student_id = cp.student_id AND a.session_id = cp.session_id AND a.status = 'active'
                  )
            """, (session_id,))
            unallocated = cur.fetchone()[0]

    return {
        "total_students": total_students,
        "total_hostels": total_hostels,
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "available_beds": total_beds - occupied_beds,
        "active_allocations": active_allocations,
        "applications": applications,
        "revenue_kobo": revenue,
        "revenue_naira": revenue // 100,
        "unallocated_eligible": unallocated,
    }


# ════════════════════════════════════════════════════════════
# STUDENTS
# ════════════════════════════════════════════════════════════

@router.get("/students")
def list_students(admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("""
            SELECT u.id, u.identifier, u.surname, u.first_name, u.gender,
                   u.department, u.level, u.study_type,
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
            "id": r[0], "identifier": r[1],
            "full_name": f"{r[2]} {r[3]}",
            "gender": r[4], "department": r[5], "level": r[6],
            "study_type": r[7], "is_allocated": r[8],
        }
        for r in rows
    ]


# ════════════════════════════════════════════════════════════
# ALLOCATIONS
# ════════════════════════════════════════════════════════════

@router.get("/allocations")
def list_allocations(admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("""
            SELECT a.id, a.student_id, u.identifier, u.surname || ' ' || u.first_name,
                   h.name, bl.name, r.room_number, b.bed_number,
                   a.matched_from_preference, a.avg_compatibility_score, a.allocated_at
            FROM allocations a
            JOIN users u ON u.id = a.student_id
            JOIN beds b ON b.id = a.bed_id
            JOIN rooms r ON r.id = b.room_id
            JOIN blocks bl ON bl.id = r.block_id
            JOIN hostels h ON h.id = bl.hostel_id
            JOIN academic_sessions s ON s.id = a.session_id
            WHERE s.is_active = TRUE AND a.status = 'active'
            ORDER BY a.allocated_at DESC
        """)
        rows = cur.fetchall()

    return [
        {
            "id": r[0], "student_id": r[1], "identifier": r[2], "full_name": r[3],
            "hostel_name": r[4], "block_name": r[5], "room_number": r[6], "bed_number": r[7],
            "matched_from_preference": r[8],
            "compatibility_score": float(r[9]) if r[9] else None,
            "allocated_at": r[10].isoformat() if r[10] else None,
        }
        for r in rows
    ]


@router.delete("/allocations/{allocation_id}")
def revoke_allocation(allocation_id: int, admin=Depends(get_current_admin)):
    """Revoke a student's allocation and free the bed."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT student_id, bed_id, session_id FROM allocations WHERE id = %s AND status = 'active'",
                (allocation_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Active allocation not found")

            student_id, bed_id, session_id = row

            cur.execute(
                """UPDATE allocations
                   SET status = 'revoked', revocation_reason = 'Admin revocation',
                       revoked_by = %s, revoked_at = NOW()
                   WHERE id = %s""",
                (admin["identifier"], allocation_id),
            )
            cur.execute("UPDATE beds SET status = 'vacant' WHERE id = %s", (bed_id,))
            conn.commit()

    log_event(
        ALLOCATION_REVOKED, "admin", admin["identifier"],
        f"Revoked allocation #{allocation_id}",
        target_entity="allocation", target_id=str(allocation_id),
        session_id=session_id,
    )
    return {"message": "Allocation revoked. Bed freed."}


@router.post("/students/{student_id}/manual-pay")
def manual_confirm_payment(student_id: int, admin=Depends(get_current_admin)):
    """Admin manually marks a student as paid for the active session."""
    from .payment import _confirm_payment_internal, _compute_fee
    from services.receipt import generate_hms_reference

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Active session
            cur.execute("SELECT id, year_end FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
            sess = cur.fetchone()
            if not sess: raise HTTPException(status_code=404, detail="No active session")
            session_id, year_end = sess

            # Check existing confirmed payment
            cur.execute("SELECT id, status FROM confirmed_payments WHERE student_id = %s AND session_id = %s", (student_id, session_id))
            cp = cur.fetchone()

            if cp and cp[1] == 'confirmed':
                raise HTTPException(status_code=400, detail="Student has already paid for this session")

            # Get user info for fee components
            cur.execute("SELECT study_type, level FROM users WHERE id = %s", (student_id,))
            u = cur.fetchone()
            if not u: raise HTTPException(status_code=404, detail="Student not found")

            # Compute fee to know what to log
            _, total_kobo = _compute_fee(session_id, u[0] or "Full-time", u[1] or "")

            if not cp:
                # Create NEW record
                hms_ref = generate_hms_reference(year_end or 2026)
                cur.execute(
                    """INSERT INTO confirmed_payments (student_id, session_id, hms_reference, total_amount_kobo, status, payment_channel)
                       VALUES (%s, %s, %s, %s, 'pending', 'admin_manual') RETURNING id""",
                    (student_id, session_id, hms_ref, total_kobo),
                )
                payment_id = cur.fetchone()[0]
                conn.commit()
            else:
                payment_id = cp[0]

    # Finalize it (updates application, logs components, etc.)
    success = _confirm_payment_internal(payment_id, "admin_manual", f"ADMIN-{admin['identifier']}")
    return {"message": "Student marked as paid successfully"}


@router.get("/eligible-students")
def list_eligible_students(admin=Depends(get_current_admin)):
    """
    Students who have a confirmed payment in the active session
    but have NOT yet been allocated a bed.
    These are the students ready to receive a room assignment.
    """
    with get_cursor() as cur:
        cur.execute("""
            SELECT u.id, u.identifier,
                   u.surname || ' ' || u.first_name AS full_name,
                   u.gender, u.department, u.level, u.study_type,
                   cp.confirmed_at AS eligible_at
            FROM users u
            JOIN confirmed_payments cp
                ON cp.student_id = u.id
            JOIN academic_sessions s
                ON s.id = cp.session_id AND s.is_active = TRUE
            LEFT JOIN allocations a
                ON a.student_id = u.id
                AND a.session_id = s.id
                AND a.status = 'active'
            WHERE u.role = 'student'
              AND cp.status = 'confirmed'
              AND a.id IS NULL
            ORDER BY cp.confirmed_at ASC
        """)
        rows = cur.fetchall()

    return [
        {
            "id": r[0], "identifier": r[1], "full_name": r[2],
            "gender": r[3], "department": r[4], "level": r[5],
            "study_type": r[6],
            "eligible_at": r[7].isoformat() if r[7] else None,
        }
        for r in rows
    ]


@router.get("/checkouts")
def list_checkouts(admin=Depends(get_current_admin)):
    """
    Allocation checkout history — revoked and expired allocations
    for the active session.
    """
    with get_cursor() as cur:
        cur.execute("""
            SELECT a.id, a.student_id, u.identifier,
                   u.surname || ' ' || u.first_name AS full_name,
                   h.name AS hostel_name, r.room_number, b.bed_number,
                   a.status AS checkout_type,
                   a.revocation_reason AS reason,
                   a.revoked_by AS recorded_by,
                   COALESCE(a.revoked_at, a.allocated_at) AS checked_out_at
            FROM allocations a
            JOIN users u ON u.id = a.student_id
            JOIN beds b ON b.id = a.bed_id
            JOIN rooms r ON r.id = b.room_id
            JOIN blocks bl ON bl.id = r.block_id
            JOIN hostels h ON h.id = bl.hostel_id
            JOIN academic_sessions s ON s.id = a.session_id
            WHERE s.is_active = TRUE
              AND a.status IN ('revoked', 'expired')
            ORDER BY COALESCE(a.revoked_at, a.allocated_at) DESC
        """)
        rows = cur.fetchall()

    return [
        {
            "id": r[0], "student_id": r[1], "identifier": r[2], "full_name": r[3],
            "hostel_name": r[4], "room_number": r[5], "bed_number": r[6],
            "checkout_type": r[7],
            "reason": r[8], "recorded_by": r[9],
            "checked_out_at": r[10].isoformat() if r[10] else None,
        }
        for r in rows
    ]


# ════════════════════════════════════════════════════════════
# TRANSACTIONS (confirmed payments)
# ════════════════════════════════════════════════════════════

@router.get("/transactions")
def list_transactions(status: Optional[str] = None, admin=Depends(get_current_admin)):
    query = """
        SELECT cp.id, cp.student_id, u.identifier,
               u.surname || ' ' || u.first_name,
               cp.hms_reference, cp.total_amount_kobo, cp.status,
               cp.payment_channel, cp.confirmed_at, cp.session_id,
               s.session_name,
               h1.name as choice_1, h2.name as choice_2, h3.name as choice_3
        FROM confirmed_payments cp
        JOIN users u ON u.id = cp.student_id
        LEFT JOIN academic_sessions s ON s.id = cp.session_id
        LEFT JOIN hostel_applications ha ON ha.student_id = cp.student_id AND ha.session_id = cp.session_id
        LEFT JOIN hostels h1 ON h1.id = ha.choice_1_id
        LEFT JOIN hostels h2 ON h2.id = ha.choice_2_id
        LEFT JOIN hostels h3 ON h3.id = ha.choice_3_id
    """
    params = []
    if status:
        query += " WHERE cp.status = %s"
        params.append(status)

    query += " ORDER BY cp.confirmed_at DESC NULLS LAST, cp.id DESC LIMIT 500"

    with get_cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    return [
        {
            "id": r[0], "student_id": r[1], "identifier": r[2], "full_name": r[3],
            "hms_reference": r[4], "amount": r[5] // 100 if r[5] else 0,
            "status": r[6], "payment_channel": r[7],
            "confirmed_at": r[8].isoformat() if r[8] else None,
            "session_name": r[10],
            "choice_1": r[11], "choice_2": r[12], "choice_3": r[13],
        }
        for r in rows
    ]



# ════════════════════════════════════════════════════════════
# AUDIT LOGS
# ════════════════════════════════════════════════════════════

@router.get("/audit-logs")
def list_audit_logs(
    page: int = 1,
    limit: int = 50,
    action_type: Optional[str] = None,
    actor_id: Optional[str] = None,
    admin=Depends(get_current_admin),
):
    """Paginated audit log query."""
    offset = (page - 1) * limit
    conditions = []
    params = []

    if action_type:
        conditions.append("action_type = %s")
        params.append(action_type)
    if actor_id:
        conditions.append("actor_id = %s")
        params.append(actor_id)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM audit_logs {where}", params)
        total = cur.fetchone()[0]

        cur.execute(
            f"""SELECT id, timestamp, actor_type, actor_id, action_type,
                       target_entity, target_id, description, metadata, session_id
                FROM audit_logs {where}
                ORDER BY timestamp DESC
                LIMIT %s OFFSET %s""",
            params + [limit, offset],
        )
        rows = cur.fetchall()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "logs": [
            {
                "id": r[0],
                "timestamp": r[1].isoformat() if r[1] else None,
                "actor_type": r[2], "actor_id": r[3],
                "action_type": r[4], "target_entity": r[5], "target_id": r[6],
                "description": r[7],
                "metadata": r[8] if r[8] else {},
                "session_id": r[9],
            }
            for r in rows
        ],
    }


# ════════════════════════════════════════════════════════════
# NATURAL LANGUAGE QUERY (Gemini AI)
# ════════════════════════════════════════════════════════════

class NLQueryRequest(BaseModel):
    query: str


@router.post("/nl-query")
def natural_language_query(data: NLQueryRequest, admin=Depends(get_current_admin)):
    """Convert plain English to SQL via Gemini, validate, and execute."""
    if not data.query or len(data.query.strip()) < 3:
        raise HTTPException(status_code=400, detail="Query too short")

    # Generate SQL from Gemini
    result = generate_sql(data.query.strip())
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])

    sql = result["sql"]

    # Validate — reject mutations
    is_valid, error_msg = validate_sql(sql)
    if not is_valid:
        log_event(
            ADMIN_NL_QUERY, "admin", admin["identifier"],
            f"NL query REJECTED: {data.query}",
            metadata={"query": data.query, "sql": sql, "reason": error_msg},
        )
        raise HTTPException(status_code=400, detail=error_msg)

    # Execute the validated query
    try:
        with get_cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description] if cur.description else []
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"SQL execution error: {str(e)}")

    # Log successful query
    log_event(
        ADMIN_NL_QUERY, "admin", admin["identifier"],
        f"NL query: {data.query}",
        metadata={"query": data.query, "sql": sql, "result_count": len(rows)},
    )

    return {
        "query": data.query,
        "sql": sql,
        "columns": columns,
        "rows": [
            [str(v) if v is not None else None for v in row]
            for row in rows[:100]
        ],
        "total": len(rows),
    }

