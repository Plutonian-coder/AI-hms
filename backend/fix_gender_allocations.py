"""
Fix Gender Allocation Mismatches in AWS RDS
Re-assigns male students to male hostels and female students to female hostels.
"""
import psycopg2
from config import DATABASE_URL

def fix_allocations():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()

    # Get male beds (PGD Hall & Hollywood)
    cur.execute("""
        SELECT b.id 
        FROM beds b
        JOIN rooms r ON b.room_id = r.id
        JOIN blocks bl ON r.block_id = bl.id
        JOIN hostels h ON bl.hostel_id = h.id
        WHERE h.gender_restriction = 'male'
        ORDER BY b.id;
    """)
    male_beds = [r[0] for r in cur.fetchall()]

    # Get female beds (Akata, Complex, New Female, Augustus, Bakassi)
    cur.execute("""
        SELECT b.id 
        FROM beds b
        JOIN rooms r ON b.room_id = r.id
        JOIN blocks bl ON r.block_id = bl.id
        JOIN hostels h ON bl.hostel_id = h.id
        WHERE h.gender_restriction = 'female'
        ORDER BY b.id;
    """)
    female_beds = [r[0] for r in cur.fetchall()]

    # Fetch all allocations
    cur.execute("""
        SELECT a.id, u.gender 
        FROM allocations a 
        JOIN users u ON a.student_id = u.id
        ORDER BY a.id;
    """)
    allocs = cur.fetchall()

    male_idx = 0
    female_idx = 0

    for alloc_id, gender in allocs:
        if gender.lower() == 'male':
            new_bed = male_beds[male_idx % len(male_beds)]
            male_idx += 1
        else:
            new_bed = female_beds[female_idx % len(female_beds)]
            female_idx += 1

        cur.execute("UPDATE allocations SET bed_id = %s WHERE id = %s", (new_bed, alloc_id))

    print(f"[SUCCESS] Re-assigned {len(allocs)} allocations to gender-matched beds!")
    conn.close()

if __name__ == "__main__":
    fix_allocations()
