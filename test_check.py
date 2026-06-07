import os
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from database import get_cursor

print("Querying database tables...")
with get_cursor() as cur:
    # Get active sessions
    cur.execute("SELECT id, session_name, is_active FROM academic_sessions")
    sessions = cur.fetchall()
    print("Sessions:", sessions)

    # Get users
    cur.execute("SELECT id, identifier, surname, first_name, role FROM users LIMIT 10")
    users = cur.fetchall()
    print("Users (first 10):", users)

    # Get allocations
    cur.execute("SELECT id, student_id, bed_id, session_id, status FROM allocations")
    allocations = cur.fetchall()
    print("Allocations:", allocations)

    # Let's also check if there is an active session
    cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
    active_sess = cur.fetchone()
    print("Active Session ID:", active_sess)
