"""
Admin Router — For managing hostels, rooms, beds, and session state.
"""
from fastapi import APIRouter, HTTPException, Depends
from models import HostelCreate
from database import get_cursor, get_connection
from dependencies import get_current_admin
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


class SessionCreate(BaseModel):
    session_name: str


# ---- Sessions ----

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


# ---- Hostels ----

@router.post("/hostels")
def create_hostel(data: HostelCreate, admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute(
            "INSERT INTO hostels (name, gender_restriction) VALUES (%s, %s) RETURNING id",
            (data.name, data.gender_restriction)
        )
        hostel_id = cur.fetchone()[0]
    return {"message": "Hostel created", "hostel_id": hostel_id}


@router.get("/hostels")
def list_hostels(admin=Depends(get_current_admin)):
    with get_cursor() as cur:
        cur.execute("""
            SELECT h.id, h.name, h.gender_restriction, h.capacity,
                   COUNT(a.id) AS occupied
            FROM hostels h
            LEFT JOIN rooms r ON r.hostel_id = h.id
            LEFT JOIN beds b ON b.room_id = r.id
            LEFT JOIN allocations a ON a.bed_id = b.id
                AND a.session_id = (SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1)
            GROUP BY h.id
            ORDER BY h.name
        """)
        rows = cur.fetchall()

    return [
        {"id": r[0], "name": r[1], "gender": r[2], "capacity": r[3], "occupied": r[4], "available": r[3] - r[4]}
        for r in rows
    ]


# ---- Rooms & Beds ----

@router.post("/hostels/{hostel_id}/rooms")
def create_many_rooms_and_beds(hostel_id: int, num_rooms: int = 50, beds_per_room: int = 4, admin=Depends(get_current_admin)):
    """Bulk auto-generate rooms and bedspaces within a hostel."""
    created_rooms = 0
    created_beds = 0

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT capacity, name FROM hostels WHERE id = %s", (hostel_id,))
            hostel = cur.fetchone()
            if not hostel:
                raise HTTPException(status_code=404, detail="Hostel not found")

            for i in range(1, num_rooms + 1):
                room_number = f"R{i:03d}"
                cur.execute(
                    "INSERT INTO rooms (hostel_id, room_number) VALUES (%s, %s) RETURNING id",
                    (hostel_id, room_number)
                )
                room_id = cur.fetchone()[0]
                created_rooms += 1

                for bed_idx in range(1, beds_per_room + 1):
                    cur.execute(
                        "INSERT INTO beds (room_id, bed_number) VALUES (%s, %s)",
                        (room_id, bed_idx)
                    )
                    created_beds += 1

            new_capacity = hostel[0] + created_beds
            cur.execute("UPDATE hostels SET capacity = %s WHERE id = %s", (new_capacity, hostel_id))
            conn.commit()

    return {
        "message": f"Successfully added {created_rooms} rooms and {created_beds} beds to {hostel[1]}",
        "new_capacity": new_capacity
    }


# ---- Stats ----

@router.get("/stats")
def get_admin_stats(admin=Depends(get_current_admin)):
    """Get overview stats for the admin dashboard."""
    with get_cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM users WHERE role = 'student'")
        total_students = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM hostels")
        total_hostels = cur.fetchone()[0]

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
            WHERE s.is_active = TRUE
        """)
        active_allocations = cur.fetchone()[0]

    return {
        "total_students": total_students,
        "total_hostels": total_hostels,
        "total_beds": total_beds,
        "occupied_beds": occupied_beds,
        "available_beds": total_beds - occupied_beds,
        "active_allocations": active_allocations
    }


# ---- Students ----

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
