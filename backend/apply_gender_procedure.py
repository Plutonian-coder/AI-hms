import psycopg2
from config import DATABASE_URL

sql = """
CREATE OR REPLACE FUNCTION allocate_specific_bed(
    p_student_id INT,
    p_bed_id INT,
    p_session_id INT,
    p_payment_id INT,
    p_matched_preference INT,
    p_avg_score DECIMAL
)
RETURNS INT AS $$
DECLARE
    v_allocation_id INT;
    v_locked_bed_id INT;
    v_student_gender VARCHAR(10);
    v_hostel_gender VARCHAR(10);
BEGIN
    -- Check if already allocated this session
    IF EXISTS (
        SELECT 1 FROM allocations
        WHERE student_id = p_student_id
          AND session_id = p_session_id
          AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Student % already has an active allocation for session %', p_student_id, p_session_id;
    END IF;

    -- Verify gender restriction
    SELECT u.gender, h.gender_restriction INTO v_student_gender, v_hostel_gender
    FROM users u, beds b
    JOIN rooms r ON b.room_id = r.id
    JOIN blocks bl ON r.block_id = bl.id
    JOIN hostels h ON bl.hostel_id = h.id
    WHERE u.id = p_student_id AND b.id = p_bed_id;

    IF v_hostel_gender != 'mixed' AND LOWER(v_student_gender) != LOWER(v_hostel_gender) THEN
        RAISE EXCEPTION 'Gender Mismatch: Student gender does not match hostel gender restriction';
    END IF;

    -- Lock the specific bed with SKIP LOCKED
    SELECT id INTO v_locked_bed_id
    FROM beds
    WHERE id = p_bed_id AND status = 'vacant'
    FOR UPDATE SKIP LOCKED;

    IF v_locked_bed_id IS NULL THEN
        RAISE EXCEPTION 'Bed % is no longer available', p_bed_id;
    END IF;

    -- Mark bed as occupied
    UPDATE beds SET status = 'occupied' WHERE id = v_locked_bed_id;

    -- Create allocation record
    INSERT INTO allocations (
        student_id, bed_id, session_id, payment_id,
        matched_from_preference, avg_compatibility_score, status
    ) VALUES (
        p_student_id, v_locked_bed_id, p_session_id, p_payment_id,
        p_matched_preference, p_avg_score, 'active'
    ) RETURNING id INTO v_allocation_id;

    RETURN v_allocation_id;
END;
$$ LANGUAGE plpgsql;
"""

def main():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(sql)
    print("[SUCCESS] Gender allocation procedure updated on AWS RDS!")
    conn.close()

if __name__ == "__main__":
    main()
