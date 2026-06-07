"""
Admin Router — Session management, hostel infrastructure, fee components,
               student management, allocations, medical review, and audit trail.
"""
import os
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
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
    log_event, SESSION_CREATED, SESSION_ACTIVATED, PORTAL_TOGGLED, SESSION_ENDED,
    FEE_COMPONENT_ADDED, FEE_COMPONENT_UPDATED, HOSTEL_CREATED, HOSTEL_DELETED,
    ALLOCATION_REVOKED, ADMIN_NL_QUERY,
    MEDICAL_REVIEW_APPROVED, MEDICAL_REVIEW_REJECTED, ADMIN_STATUS_UPDATE,
)
from services.email import (
    send_medical_review_email, send_status_change_email, send_allocation_revoked_email,
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


@router.post("/sessions/{session_id}/reactivate")
def reactivate_session(session_id: int, admin=Depends(get_current_admin)):
    """Reactivate a past session — pauses the current active session (does NOT expire its allocations)."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            # 1. Verify target session exists and is not already active
            cur.execute("SELECT id, session_name, is_active FROM academic_sessions WHERE id = %s", (session_id,))
            target = cur.fetchone()
            if not target:
                raise HTTPException(status_code=404, detail="Session not found")
            if target[2]:
                raise HTTPException(status_code=409, detail="This session is already active")

            # 2. Pause current active session (close portals but don't expire allocations or mark ended)
            cur.execute("SELECT id, session_name FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
            current = cur.fetchone()
            if current:
                cur.execute(
                    """UPDATE academic_sessions
                       SET is_active = FALSE,
                           application_portal_open = FALSE, payment_portal_open = FALSE,
                           allocation_portal_open = FALSE, register_import_open = FALSE
                       WHERE id = %s""",
                    (current[0],),
                )
                # Set the beds occupied by the paused session's active allocations to 'vacant'
                cur.execute(
                    """UPDATE beds
                       SET status = 'vacant'
                       WHERE id IN (
                           SELECT bed_id FROM allocations
                           WHERE session_id = %s AND status = 'active'
                       )""",
                    (current[0],),
                )

            # 3. Activate target session
            cur.execute(
                "UPDATE academic_sessions SET is_active = TRUE, session_ended = FALSE WHERE id = %s",
                (session_id,),
            )
            # Restore expired allocations of the reactivated session to active
            cur.execute(
                """UPDATE allocations
                   SET status = 'active'
                   WHERE session_id = %s AND status = 'expired'""",
                (session_id,),
            )
            # Set the beds of the reactivated session's active allocations to 'occupied'
            cur.execute(
                """UPDATE beds
                   SET status = 'occupied'
                   WHERE id IN (
                       SELECT bed_id FROM allocations
                       WHERE session_id = %s AND status = 'active'
                   )""",
                (session_id,),
            )
            conn.commit()

    log_event(
        SESSION_ACTIVATED, "admin", admin["identifier"],
        f"Reactivated session '{target[1]}'" + (f" (paused '{current[1]}')" if current else ""),
        target_entity="session", target_id=str(session_id),
        session_id=session_id,
    )

    msg = f"Session '{target[1]}' is now active."
    if current:
        msg += f" '{current[1]}' has been paused."
    return {"message": msg}


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
            """SELECT id, name, amount_fulltime, amount_parttime, amount_codfel,
                      applies_to, is_mandatory, sort_order
               FROM fee_components WHERE session_id = %s ORDER BY sort_order, id""",
            (session[0],),
        )
        rows = cur.fetchall()

    return [
        {
            "id": r[0], "name": r[1],
            "amount_fulltime": r[2], "amount_parttime": r[3], "amount_codfel": r[4],
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
               (session_id, name, amount_fulltime, amount_parttime, amount_codfel,
                applies_to, is_mandatory, sort_order)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
            (session[0], data.name, data.amount_fulltime, data.amount_parttime,
             data.amount_codfel, data.applies_to, data.is_mandatory, data.sort_order),
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
    for field in ["name", "amount_fulltime", "amount_parttime", "amount_codfel",
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


@router.delete("/hostels/{hostel_id}")
def delete_hostel(hostel_id: int, admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute(
            "SELECT name, occupied FROM ("
            "  SELECT h.name, COUNT(CASE WHEN b.status = 'occupied' THEN 1 END) AS occupied"
            "  FROM hostels h"
            "  LEFT JOIN blocks bl ON bl.hostel_id = h.id"
            "  LEFT JOIN rooms r ON r.block_id = bl.id"
            "  LEFT JOIN beds b ON b.room_id = r.id"
            "  WHERE h.id = %s GROUP BY h.name"
            ") sub",
            (hostel_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Hostel not found")
        name, occupied = row
        if occupied and int(occupied) > 0:
            raise HTTPException(
                status_code=409,
                detail=f"Cannot delete '{name}': {occupied} bed(s) are currently occupied. Revoke all allocations first.",
            )
        cur.execute("DELETE FROM hostels WHERE id = %s", (hostel_id,))

    log_event(
        HOSTEL_DELETED, "admin", admin["identifier"],
        f"Deleted hostel '{name}'",
        target_entity="hostel", target_id=str(hostel_id),
    )
    return {"message": f"Hostel '{name}' deleted successfully"}


# ── Hostel Prices ────────────────────────────────────────────────────────────

class HostelPriceItem(BaseModel):
    program_type: str
    amount: int


class HostelPriceListBody(BaseModel):
    prices: list[HostelPriceItem]


@router.get("/hostels/{hostel_id}/prices")
def get_hostel_prices(hostel_id: int, admin=Depends(get_current_admin)):
    """Return per-program-type pricing overrides for a specific hostel."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM hostels WHERE id = %s", (hostel_id,))
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="Hostel not found")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS hostel_prices (
                    id SERIAL PRIMARY KEY,
                    hostel_id INT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
                    program_type VARCHAR(20) NOT NULL,
                    amount INT NOT NULL DEFAULT 0,
                    UNIQUE(hostel_id, program_type)
                )
            """)
            conn.commit()
            cur.execute(
                "SELECT program_type, amount FROM hostel_prices WHERE hostel_id = %s ORDER BY program_type",
                (hostel_id,),
            )
            rows = cur.fetchall()
    return [{"program_type": r[0], "amount": r[1]} for r in rows]


@router.put("/hostels/{hostel_id}/prices")
def update_hostel_prices(hostel_id: int, data: HostelPriceListBody, admin=Depends(get_current_admin)):
    """Upsert per-program-type pricing overrides for a hostel."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM hostels WHERE id = %s", (hostel_id,))
            hostel = cur.fetchone()
            if not hostel:
                raise HTTPException(status_code=404, detail="Hostel not found")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS hostel_prices (
                    id SERIAL PRIMARY KEY,
                    hostel_id INT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
                    program_type VARCHAR(20) NOT NULL,
                    amount INT NOT NULL DEFAULT 0,
                    UNIQUE(hostel_id, program_type)
                )
            """)
            for p in data.prices:
                cur.execute(
                    """INSERT INTO hostel_prices (hostel_id, program_type, amount)
                       VALUES (%s, %s, %s)
                       ON CONFLICT (hostel_id, program_type) DO UPDATE SET amount = EXCLUDED.amount""",
                    (hostel_id, p.program_type, p.amount),
                )
            conn.commit()
    return {"message": f"Prices updated for {hostel[0]}"}


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

        # Students in the session register (eligible roster count)
        eligible_count = 0
        if session_id:
            cur.execute("SELECT COUNT(*) FROM session_register WHERE session_id = %s", (session_id,))
            eligible_count = cur.fetchone()[0]

        # Students who have created portal accounts (regardless of session)
        portal_registered = total_students  # already queried above

        # Pipeline stats
        pending_reviews = 0
        medical_approved_count = 0
        medical_rejected_count = 0
        status_breakdown = {}
        if session_id:
            cur.execute("SELECT COUNT(*) FROM hostel_applications WHERE session_id = %s AND status = 'pending_verification'", (session_id,))
            pending_reviews = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM hostel_applications WHERE session_id = %s AND status = 'medical_approved'", (session_id,))
            medical_approved_count = cur.fetchone()[0]
            cur.execute("SELECT COUNT(*) FROM hostel_applications WHERE session_id = %s AND status = 'medical_rejected'", (session_id,))
            medical_rejected_count = cur.fetchone()[0]
            cur.execute("SELECT status, COUNT(*) FROM hostel_applications WHERE session_id = %s GROUP BY status", (session_id,))
            for row in cur.fetchall():
                status_breakdown[row[0]] = row[1]

    return {
        "total_students": total_students,
        "eligible_count": eligible_count,
        "total_hostels": total_hostels,
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "available_beds": total_beds - occupied_beds,
        "active_allocations": active_allocations,
        "applications": applications,
        "revenue_kobo": revenue,
        "revenue_naira": revenue // 100,
        "unallocated_eligible": unallocated,
        "pending_reviews": pending_reviews,
        "medical_approved": medical_approved_count,
        "medical_rejected": medical_rejected_count,
        "status_breakdown": status_breakdown,
    }


# ════════════════════════════════════════════════════════════
# MEDICAL REVIEW QUEUE
# ════════════════════════════════════════════════════════════

@router.get("/review-queue")
def get_review_queue(status_filter: Optional[str] = None, admin=Depends(get_current_admin)):
    """All applications requiring medical document review."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        session = cur.fetchone()
        if not session:
            return []

        conditions = ["ha.session_id = %s"]
        params = [session[0]]

        if status_filter == "pending":
            conditions.append("ha.status = 'pending_verification'")
        elif status_filter == "approved":
            conditions.append("ha.status IN ('medical_approved', 'ready_for_allocation', 'allocated', 'paid')")
        elif status_filter == "rejected":
            conditions.append("ha.status = 'medical_rejected'")
        else:
            conditions.append("ha.has_special_needs = TRUE")

        where = " AND ".join(conditions)

        cur.execute(f"""
            SELECT ha.id, u.identifier, u.surname || ' ' || u.first_name,
                   ha.special_needs_type, ha.medical_doc_original_name,
                   ha.submitted_at, ha.upload_attempt, ha.status,
                   ha.medical_review_notes, ha.medical_reviewed_at,
                   u.id as user_id, u.department, u.level, u.gender
            FROM hostel_applications ha
            JOIN users u ON u.id = ha.student_id
            WHERE {where}
            ORDER BY ha.submitted_at DESC NULLS LAST
        """, params)
        rows = cur.fetchall()

    return [
        {
            "application_id": r[0],
            "identifier": r[1],
            "full_name": r[2],
            "special_needs_type": r[3],
            "medical_doc_name": r[4],
            "submitted_at": r[5].isoformat() if r[5] else None,
            "upload_attempt": r[6],
            "status": r[7],
            "review_notes": r[8],
            "reviewed_at": r[9].isoformat() if r[9] else None,
            "student_id": r[10],
            "department": r[11],
            "level": r[12],
            "gender": r[13],
        }
        for r in rows
    ]


@router.get("/medical-doc/{application_id}")
def get_medical_doc(application_id: int, admin=Depends(get_current_admin)):
    """Serve the uploaded medical document for inline viewing or download."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT medical_doc_path, medical_doc_original_name FROM hostel_applications WHERE id = %s",
            (application_id,),
        )
        row = cur.fetchone()

    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="No medical document found for this application")

    file_path = row[0]
    original_name = row[1] or "document"

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Medical document file not found on server")

    ext = os.path.splitext(file_path)[1].lower()
    media_types = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=original_name,
    )


class ReviewActionBody(BaseModel):
    action: str  # 'approve' or 'reject'
    notes: str = ""


@router.post("/review/{application_id}")
def review_medical_doc(application_id: int, data: ReviewActionBody, admin=Depends(get_current_admin)):
    """Approve or reject a student's medical documentation."""
    if data.action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="Action must be 'approve' or 'reject'")

    with get_cursor() as cur:
        cur.execute(
            """SELECT ha.id, ha.status, ha.has_special_needs, ha.upload_attempt,
                      u.email, u.first_name, u.identifier, u.id
               FROM hostel_applications ha
               JOIN users u ON u.id = ha.student_id
               WHERE ha.id = %s""",
            (application_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Application not found")

        app_id, app_status, has_special_needs, upload_attempt, email, first_name, matric, student_id = row

        if not has_special_needs:
            raise HTTPException(status_code=400, detail="This application does not have special needs")

        if app_status != "pending_verification":
            raise HTTPException(status_code=409, detail=f"Application is not pending review (status: {app_status})")

        if data.action == "approve":
            new_status = "ready_for_allocation"
            cur.execute(
                """UPDATE hostel_applications
                   SET status = %s,
                       medical_reviewed_by = (SELECT id FROM users WHERE identifier = %s AND role = 'admin' LIMIT 1),
                       medical_reviewed_at = NOW(),
                       medical_review_notes = %s
                   WHERE id = %s""",
                (new_status, admin["identifier"], data.notes or "Approved", app_id),
            )
            log_event(
                MEDICAL_REVIEW_APPROVED, "admin", admin["identifier"],
                f"Approved medical docs for {matric}",
                target_entity="hostel_application", target_id=str(app_id),
                metadata={"notes": data.notes},
            )
        else:
            new_status = "medical_rejected"
            if not data.notes:
                raise HTTPException(status_code=400, detail="Rejection notes are required")
            cur.execute(
                """UPDATE hostel_applications
                   SET status = %s,
                       medical_reviewed_by = (SELECT id FROM users WHERE identifier = %s AND role = 'admin' LIMIT 1),
                       medical_reviewed_at = NOW(),
                       medical_review_notes = %s
                   WHERE id = %s""",
                (new_status, admin["identifier"], data.notes, app_id),
            )
            log_event(
                MEDICAL_REVIEW_REJECTED, "admin", admin["identifier"],
                f"Rejected medical docs for {matric}",
                target_entity="hostel_application", target_id=str(app_id),
                metadata={"notes": data.notes, "upload_attempt": upload_attempt},
            )

    # Send email notification
    if email:
        try:
            attempts_remaining = max(0, 3 - (upload_attempt or 0))
            send_medical_review_email(
                to_email=email,
                first_name=first_name or "Student",
                status="approved" if data.action == "approve" else "rejected",
                notes=data.notes,
                attempts_remaining=attempts_remaining,
            )
        except Exception:
            pass

    return {
        "message": f"Application {data.action}d successfully",
        "application_id": app_id,
        "new_status": new_status,
    }


# ════════════════════════════════════════════════════════════
# APPLICATION TRACKER
# ════════════════════════════════════════════════════════════

@router.get("/application-tracker")
def get_application_tracker(
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    admin=Depends(get_current_admin),
):
    """List all applications for the active session with full pipeline state."""
    with get_cursor() as cur:
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        session = cur.fetchone()
        if not session:
            return []

        conditions = ["ha.session_id = %s"]
        params = [session[0]]

        if status_filter:
            conditions.append("ha.status = %s")
            params.append(status_filter)

        if search:
            conditions.append("(UPPER(u.identifier) LIKE UPPER(%s) OR UPPER(u.surname || ' ' || u.first_name) LIKE UPPER(%s))")
            params.extend([f"%{search}%", f"%{search}%"])

        where = " AND ".join(conditions)

        cur.execute(f"""
            SELECT ha.id, u.identifier, u.surname || ' ' || u.first_name,
                   ha.status, ha.stage_completed, ha.has_special_needs,
                   ha.submitted_at, ha.admin_status_note, ha.admin_status_updated_at,
                   ha.medical_reviewed_at, ha.medical_review_notes,
                   u.department, u.level, u.gender, ha.submitted_at
            FROM hostel_applications ha
            JOIN users u ON u.id = ha.student_id
            WHERE {where}
            ORDER BY ha.submitted_at DESC NULLS LAST
        """, params)
        rows = cur.fetchall()

    return [
        {
            "application_id": r[0],
            "identifier": r[1],
            "full_name": r[2],
            "status": r[3],
            "stage_completed": r[4],
            "has_special_needs": r[5],
            "submitted_at": r[6].isoformat() if r[6] else None,
            "admin_status_note": r[7],
            "admin_status_updated_at": r[8].isoformat() if r[8] else None,
            "medical_reviewed_at": r[9].isoformat() if r[9] else None,
            "medical_review_notes": r[10],
            "department": r[11],
            "level": r[12],
            "gender": r[13],
            "created_at": r[14].isoformat() if r[14] else None,  # maps to submitted_at
        }
        for r in rows
    ]


class AdminStatusUpdateBody(BaseModel):
    note: str
    status: Optional[str] = None


VALID_FORWARD_TRANSITIONS = {
    "draft": ["submitted", "pending_verification", "ready_for_allocation"],
    "submitted": ["pending_verification", "ready_for_allocation"],
    "pending_verification": ["medical_approved", "medical_rejected", "ready_for_allocation"],
    "medical_approved": ["ready_for_allocation"],
    "medical_rejected": ["pending_verification", "draft"],
    "ready_for_allocation": ["allocated"],
    "allocated": ["paid"],
    "paid": [],
    "cancelled": [],
}


@router.post("/application/{application_id}/update-status")
def update_application_status(application_id: int, data: AdminStatusUpdateBody, admin=Depends(get_current_admin)):
    """Admin commits a status note and optionally advances status."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, status, student_id, session_id FROM hostel_applications WHERE id = %s",
            (application_id,),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Application not found")

        app_id, current_status, student_id, app_session_id = row

        update_fields = [
            "admin_status_note = %s",
            "admin_status_updated_at = NOW()",
            "admin_status_updated_by = (SELECT id FROM users WHERE identifier = %s AND role = 'admin' LIMIT 1)",
        ]
        params = [data.note, admin["identifier"]]

        if data.status and data.status != current_status:
            valid = VALID_FORWARD_TRANSITIONS.get(current_status, [])
            if data.status not in valid:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot transition from '{current_status}' to '{data.status}'. Valid: {valid}",
                )
            update_fields.append("status = %s")
            params.append(data.status)

        params.append(app_id)
        cur.execute(
            f"UPDATE hostel_applications SET {', '.join(update_fields)} WHERE id = %s",
            params,
        )

    log_event(
        ADMIN_STATUS_UPDATE, "admin", admin["identifier"],
        f"Updated application #{app_id}: {data.note}",
        target_entity="hostel_application", target_id=str(app_id),
        metadata={"note": data.note, "new_status": data.status},
    )

    # Send email notification to the student about the status change
    email_sent = False
    try:
        with get_cursor() as cur:
            cur.execute(
                "SELECT identifier, first_name, email FROM users WHERE id = %s",
                (student_id,),
            )
            stu = cur.fetchone()

        if stu and stu[2]:  # has email
            send_status_change_email(
                to_email=stu[2],
                first_name=stu[1],
                matric=stu[0],
                old_status=current_status,
                new_status=data.status or current_status,
                admin_note=data.note or "",
                user_id=student_id,
                session_id=app_session_id,
            )
            email_sent = True
    except Exception:
        pass  # Email failure must not block the status update

    return {
        "message": "Application status updated",
        "application_id": app_id,
        "new_status": data.status or current_status,
        "email_sent": email_sent,
    }


# ════════════════════════════════════════════════════════════
# STUDENTS
# ════════════════════════════════════════════════════════════

@router.get("/students")
def list_students(session_id: Optional[int] = None, admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        if session_id is None:
            cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
            session = cur.fetchone()
            session_id = session[0] if session else None

        if session_id:
            # Show all students in the session register + their portal/payment/allocation status
            cur.execute("""
                SELECT
                    sr.matric_number                                    AS identifier,
                    COALESCE(u.surname,     sr.surname)                 AS surname,
                    COALESCE(u.first_name,  sr.first_name)              AS first_name,
                    COALESCE(u.gender,      sr.gender)                  AS gender,
                    COALESCE(u.department,  sr.department)              AS department,
                    COALESCE(u.level,       sr.level)                   AS level,
                    COALESCE(u.study_type,  sr.study_type)              AS study_type,
                    u.id                                                AS user_id,
                    u.phone,
                    u.next_of_kin_phone,
                    (u.id IS NOT NULL)                                  AS has_portal_access,
                    (cp.id IS NOT NULL)                                 AS has_paid,
                    (a.id  IS NOT NULL)                                 AS is_allocated,
                    u.is_active
                FROM session_register sr
                LEFT JOIN users u
                    ON UPPER(u.identifier) = UPPER(sr.matric_number)
                LEFT JOIN confirmed_payments cp
                    ON cp.student_id = u.id AND cp.session_id = %s AND cp.status = 'confirmed'
                LEFT JOIN allocations a
                    ON a.student_id = u.id AND a.session_id = %s AND a.status = 'active'
                WHERE sr.session_id = %s
                ORDER BY surname, first_name
            """, (session_id, session_id, session_id))
        else:
            # No active session — fall back to portal accounts only
            cur.execute("""
                SELECT u.identifier, u.surname, u.first_name, u.gender,
                       u.department, u.level, u.study_type,
                       u.id, u.phone, u.next_of_kin_phone,
                       TRUE AS has_portal_access, FALSE AS has_paid, FALSE AS is_allocated,
                       u.is_active
                FROM users u
                WHERE u.role = 'student'
                ORDER BY u.surname, u.first_name
            """)

        rows = cur.fetchall()

    result = []
    for r in rows:
        level = r[5] or ""
        is_active = r[13] if r[13] is not None else True
        if r[7] is None:  # no portal account
            account_status = "not_registered"
        elif not is_active:
            account_status = "suspended"
        elif level in ("400L", "500L"):
            account_status = "graduate"
        else:
            account_status = "active"

        result.append({
            "identifier":        r[0],
            "full_name":         f"{r[1]} {r[2]}",
            "gender":            r[3],
            "department":        r[4],
            "level":             r[5],
            "study_type":        r[6],
            "id":                r[7],
            "phone":             r[8],
            "next_of_kin_phone": r[9],
            "has_portal_access": bool(r[10]),
            "has_paid":          bool(r[11]),
            "is_allocated":      bool(r[12]),
            "is_active":         is_active,
            "account_status":    account_status,
        })
    return result


# ════════════════════════════════════════════════════════════
# STUDENT ACTIONS (Suspend / Reactivate / Profile)
# ════════════════════════════════════════════════════════════

@router.post("/students/{student_id}/suspend")
def suspend_student(student_id: int, admin=Depends(get_current_admin)):
    """Soft-suspend a student — sets is_active=FALSE, preserving account for reference."""
    with get_cursor() as cur:
        cur.execute("SELECT id, identifier, surname, first_name, is_active FROM users WHERE id = %s AND role = 'student'", (student_id,))
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Student not found")
        if not user[4]:
            raise HTTPException(status_code=409, detail="Student is already suspended")
        cur.execute("UPDATE users SET is_active = FALSE WHERE id = %s", (student_id,))
    log_event(
        ADMIN_STATUS_UPDATE, "admin", admin["identifier"],
        f"Suspended student {user[1]} ({user[2]} {user[3]})",
        target_entity="user", target_id=str(student_id),
    )
    return {"message": f"Student {user[1]} has been suspended. Their account is preserved for reference."}


@router.post("/students/{student_id}/reactivate")
def reactivate_student(student_id: int, admin=Depends(get_current_admin)):
    """Reactivate a suspended student account."""
    with get_cursor() as cur:
        cur.execute("SELECT id, identifier, surname, first_name, is_active FROM users WHERE id = %s AND role = 'student'", (student_id,))
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Student not found")
        if user[4]:
            raise HTTPException(status_code=409, detail="Student is already active")
        cur.execute("UPDATE users SET is_active = TRUE WHERE id = %s", (student_id,))
    log_event(
        ADMIN_STATUS_UPDATE, "admin", admin["identifier"],
        f"Reactivated student {user[1]} ({user[2]} {user[3]})",
        target_entity="user", target_id=str(student_id),
    )
    return {"message": f"Student {user[1]} has been reactivated."}


@router.get("/students/{student_id}/profile")
def get_student_profile(student_id: int, admin=Depends(get_current_admin)):
    """Full student profile with application, payment, and allocation details."""
    with get_cursor() as cur:
        cur.execute(
            """SELECT id, identifier, surname, first_name, email, phone, gender,
                      department, level, study_type, is_active,
                      next_of_kin_name, next_of_kin_phone, created_at
               FROM users WHERE id = %s AND role = 'student'""",
            (student_id,),
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Student not found")

        profile = {
            "id": user[0], "identifier": user[1],
            "surname": user[2], "first_name": user[3],
            "email": user[4], "phone": user[5], "gender": user[6],
            "department": user[7], "level": user[8], "study_type": user[9],
            "is_active": user[10],
            "next_of_kin_name": user[11], "next_of_kin_phone": user[12],
            "created_at": user[13].isoformat() if user[13] else None,
        }

        # Derive account status
        level = user[8] or ""
        if not user[10]:
            profile["account_status"] = "suspended"
        elif level in ("400L", "500L"):
            profile["account_status"] = "graduate"
        else:
            profile["account_status"] = "active"

        # Application status for active session
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        sess = cur.fetchone()
        session_id = sess[0] if sess else None

        profile["application"] = None
        profile["payment"] = None
        profile["allocation"] = None

        if session_id:
            cur.execute(
                """SELECT id, status, stage_completed, has_special_needs, submitted_at
                   FROM hostel_applications WHERE student_id = %s AND session_id = %s""",
                (student_id, session_id),
            )
            app = cur.fetchone()
            if app:
                profile["application"] = {
                    "id": app[0], "status": app[1], "stage_completed": app[2],
                    "has_special_needs": app[3],
                    "submitted_at": app[4].isoformat() if app[4] else None,
                }

            cur.execute(
                """SELECT id, hms_reference, total_amount_kobo, status, payment_channel, confirmed_at
                   FROM confirmed_payments WHERE student_id = %s AND session_id = %s ORDER BY id DESC LIMIT 1""",
                (student_id, session_id),
            )
            pay = cur.fetchone()
            if pay:
                profile["payment"] = {
                    "id": pay[0], "hms_reference": pay[1],
                    "amount_naira": pay[2] // 100 if pay[2] else 0,
                    "status": pay[3], "channel": pay[4],
                    "confirmed_at": pay[5].isoformat() if pay[5] else None,
                }

            cur.execute(
                """SELECT a.id, h.name, bl.name, r.room_number, b.bed_number, a.allocated_at, a.status
                   FROM allocations a
                   JOIN beds b ON b.id = a.bed_id
                   JOIN rooms r ON r.id = b.room_id
                   JOIN blocks bl ON bl.id = r.block_id
                   JOIN hostels h ON h.id = bl.hostel_id
                   WHERE a.student_id = %s AND a.session_id = %s
                   ORDER BY a.id DESC LIMIT 1""",
                (student_id, session_id),
            )
            alloc = cur.fetchone()
            if alloc:
                profile["allocation"] = {
                    "id": alloc[0], "hostel": alloc[1], "block": alloc[2],
                    "room": alloc[3], "bed": alloc[4],
                    "allocated_at": alloc[5].isoformat() if alloc[5] else None,
                    "status": alloc[6],
                }

    return profile


@router.get("/students/{student_id}/documents")
def get_student_documents(student_id: int, admin=Depends(get_current_admin)):
    """Get eligibility documents for a specific student."""
    with get_cursor() as cur:
        # Verify student exists
        cur.execute("SELECT id FROM users WHERE id = %s AND role = 'student'", (student_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Student not found")

        # Get active session
        cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
        sess = cur.fetchone()
        session_id = sess[0] if sess else None

        if not session_id:
            return []

        # Get uploaded documents
        cur.execute(
            """SELECT document_type, ai_verdict, rejection_reason, uploaded_at, verified_at, file_path, extracted_identifier, extracted_rrr, extracted_name
               FROM eligibility_documents
               WHERE student_id = %s AND session_id = %s""",
            (student_id, session_id),
        )
        rows = cur.fetchall()

    from .eligibility import DOC_LABELS
    return [
        {
            "document_type": r[0],
            "label": DOC_LABELS.get(r[0], r[0]),
            "ai_verdict": r[1],
            "rejection_reason": r[2],
            "uploaded_at": r[3].isoformat() if r[3] else None,
            "verified_at": r[4].isoformat() if r[4] else None,
            "file_name": os.path.basename(r[5]) if r[5] else None,
            "extracted_identifier": r[6],
            "extracted_rrr": r[7],
            "extracted_name": r[8],
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
                   a.matched_from_preference, a.avg_compatibility_score, a.allocated_at,
                   EXISTS(
                       SELECT 1 FROM confirmed_payments cp 
                       WHERE cp.student_id = a.student_id AND cp.session_id = a.session_id AND cp.status = 'confirmed'
                   ) AS has_paid,
                   u.level
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
            "has_paid": r[11],
            "level": r[12],
        }
        for r in rows
    ]


VALID_REVOCATION_REASONS = {
    "leaving_school", "suspension", "disciplinary", "medical", "transfer",
    "admin_override", "other",
}


class RevokeAllocationBody(BaseModel):
    reason: str = ""
    notes: str = ""


@router.delete("/allocations/{allocation_id}")
def revoke_allocation(allocation_id: int, body: RevokeAllocationBody = None, admin=Depends(get_current_admin)):
    """
    Revoke a student's allocation and free the bed.
    If the student has paid, a valid reason is required.
    Updates hostel_applications.status back to ready_for_allocation for instant App Tracker sync.
    Sends email notification to student.
    """
    if body is None:
        body = RevokeAllocationBody()

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Fetch allocation details
            cur.execute(
                """SELECT a.student_id, a.bed_id, a.session_id, a.payment_id,
                          h.name, r.room_number, b.bed_number
                   FROM allocations a
                   JOIN beds b ON b.id = a.bed_id
                   JOIN rooms r ON r.id = b.room_id
                   JOIN blocks bl ON bl.id = r.block_id
                   JOIN hostels h ON h.id = bl.hostel_id
                   WHERE a.id = %s AND a.status = 'active'""",
                (allocation_id,),
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Active allocation not found")

            student_id, bed_id, session_id, payment_id, hostel_name, room_number, bed_number = row

            # Check if student has paid — enforce criteria
            has_paid = False
            if payment_id:
                cur.execute(
                    "SELECT status FROM confirmed_payments WHERE id = %s",
                    (payment_id,),
                )
                pay_row = cur.fetchone()
                has_paid = pay_row and pay_row[0] == "confirmed"

            reason = body.reason.strip().lower() if body.reason else ""

            if has_paid:
                if not reason:
                    raise HTTPException(
                        status_code=400,
                        detail="Cannot revoke allocation of a student who has paid. "
                               "Provide a valid reason: leaving_school, suspension, disciplinary, medical, transfer, admin_override, other.",
                    )
                if reason not in VALID_REVOCATION_REASONS:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid revocation reason '{reason}'. "
                               f"Valid reasons: {', '.join(sorted(VALID_REVOCATION_REASONS))}",
                    )

            revocation_reason = reason or "admin_override"

            # Revoke the allocation
            cur.execute(
                """UPDATE allocations
                   SET status = 'revoked', revocation_reason = %s,
                       revoked_by = %s, revoked_at = NOW()
                   WHERE id = %s""",
                (revocation_reason, admin["identifier"], allocation_id),
            )
            cur.execute("UPDATE beds SET status = 'vacant' WHERE id = %s", (bed_id,))

            # Update hostel_applications.status back to ready_for_allocation
            # so App Tracker reflects the change instantly
            cur.execute(
                """UPDATE hostel_applications
                   SET status = 'ready_for_allocation'
                   WHERE student_id = %s AND session_id = %s AND status = 'allocated'""",
                (student_id, session_id),
            )

            conn.commit()

    log_event(
        ALLOCATION_REVOKED, "admin", admin["identifier"],
        f"Revoked allocation #{allocation_id} (reason: {revocation_reason})",
        target_entity="allocation", target_id=str(allocation_id),
        metadata={"reason": revocation_reason, "notes": body.notes, "has_paid": has_paid},
        session_id=session_id,
    )

    # Send email notification to the student
    email_sent = False
    try:
        with get_cursor() as cur:
            cur.execute(
                "SELECT identifier, first_name, email FROM users WHERE id = %s",
                (student_id,),
            )
            stu = cur.fetchone()

        if stu and stu[2]:  # has email
            send_allocation_revoked_email(
                to_email=stu[2],
                first_name=stu[1],
                matric=stu[0],
                hostel=hostel_name,
                room=room_number,
                bed=bed_number,
                reason=revocation_reason,
                notes=body.notes or "",
                user_id=student_id,
                session_id=session_id,
            )
            email_sent = True
    except Exception:
        pass  # Email failure must not block the revocation

    return {
        "message": "Allocation revoked. Bed freed.",
        "email_sent": email_sent,
        "reason": revocation_reason,
    }


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
# EMAIL LOGS
# ════════════════════════════════════════════════════════════

@router.get("/email-logs")
def list_email_logs(
    page: int = 1,
    limit: int = 50,
    email_type: Optional[str] = None,
    recipient: Optional[str] = None,
    status: Optional[str] = None,
    admin=Depends(get_current_admin),
):
    """Paginated email log query with filters."""
    offset = (page - 1) * limit
    conditions = []
    params = []

    if email_type:
        conditions.append("email_type = %s")
        params.append(email_type)
    if recipient:
        conditions.append("(recipient_email ILIKE %s OR recipient_matric ILIKE %s)")
        params.extend([f"%{recipient}%", f"%{recipient}%"])
    if status:
        conditions.append("status = %s")
        params.append(status)

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM email_logs {where}", params)
        total = cur.fetchone()[0]

        cur.execute(
            f"""SELECT id, recipient_email, recipient_name, recipient_matric,
                       subject, body_preview, email_type, status, sent_at,
                       session_id, metadata
                FROM email_logs {where}
                ORDER BY sent_at DESC
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
                "recipient_email": r[1],
                "recipient_name": r[2],
                "recipient_matric": r[3],
                "subject": r[4],
                "body_preview": r[5],
                "email_type": r[6],
                "status": r[7],
                "sent_at": r[8].isoformat() if r[8] else None,
                "session_id": r[9],
                "metadata": r[10] if r[10] else {},
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

