"""
Seed demo/test students into session_register for the active session.
Run this once so testers can self-register via the normal registration flow.
"""
import psycopg2
from config import DATABASE_URL

DEMO_STUDENTS = [
    ("DEMO/001", "Tester", "Alpha", "Male", "Computer Science", "ND1", "Full-time", "SICT"),
    ("DEMO/002", "Tester", "Bravo", "Female", "Computer Science", "ND1", "Full-time", "SICT"),
    ("DEMO/003", "Tester", "Charlie", "Male", "Electrical Engineering", "ND2", "Full-time", "SEET"),
    ("DEMO/004", "Tester", "Delta", "Female", "Civil Engineering", "HND1", "Full-time", "SEET"),
    ("DEMO/005", "Tester", "Echo", "Male", "Business Administration", "HND2", "Full-time", "SOBS"),
    ("DEMO/006", "Tester", "Foxtrot", "Female", "Mass Communication", "ND1", "Full-time", "SOCC"),
    ("DEMO/007", "Tester", "Golf", "Male", "Public Administration", "ND2", "Full-time", "SOAM"),
    ("DEMO/008", "Tester", "Hotel", "Female", "Statistics", "HND1", "Full-time", "SICT"),
    ("DEMO/009", "Tester", "India", "Male", "Computer Science", "ND1", "Full-time", "SICT"),
    ("DEMO/010", "Tester", "Juliet", "Female", "Mechanical Engineering", "ND1", "Full-time", "SEET"),
]

def seed_demo_students():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    # Get active session
    cur.execute("SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
    row = cur.fetchone()
    if not row:
        print("No active session found. Create one first.")
        return
    session_id = row[0]

    inserted = 0
    skipped = 0
    for matric, surname, first_name, gender, dept, level, study_type, faculty in DEMO_STUDENTS:
        # Check if already exists
        cur.execute(
            "SELECT id FROM session_register WHERE matric_number = %s AND session_id = %s",
            (matric, session_id),
        )
        if cur.fetchone():
            print(f"  Skipped {matric} (already in register)")
            skipped += 1
            continue

        cur.execute(
            """INSERT INTO session_register 
               (session_id, matric_number, surname, first_name, gender, department, level, study_type, faculty)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (session_id, matric, surname, first_name, gender, dept, level, study_type, faculty),
        )
        print(f"  Added {matric} — {first_name} {surname} ({dept}, {level})")
        inserted += 1

    cur.close()
    conn.close()
    print(f"\nDone! Inserted: {inserted}, Skipped: {skipped}")
    print("\nTesters can now register using any of these matric numbers:")
    for matric, _, first_name, _, _, _, _, _ in DEMO_STUDENTS:
        print(f"  Matric: {matric}  (Name: {first_name})")

if __name__ == "__main__":
    seed_demo_students()
