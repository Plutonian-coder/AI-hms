DROP FUNCTION IF EXISTS allocate_bed(INT, INT[], VARCHAR);
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[], INT);
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[]);
DROP TABLE IF EXISTS allocation_requests CASCADE;
DROP TABLE IF EXISTS allocations CASCADE;
DROP TABLE IF EXISTS mock_remita_payments CASCADE;
DROP TABLE IF EXISTS beds CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS hostels CASCADE;
DROP TABLE IF EXISTS academic_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS hostel_students CASCADE;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR UNIQUE NOT NULL,
    surname VARCHAR NOT NULL,
    first_name VARCHAR NOT NULL,
    gender VARCHAR NOT NULL CHECK (gender IN ('male', 'female')),
    role VARCHAR NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    password_hash VARCHAR NOT NULL,
    department VARCHAR,
    level VARCHAR,
    email VARCHAR,
    phone VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE academic_sessions (
    id SERIAL PRIMARY KEY,
    session_name VARCHAR UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    allocation_portal_open BOOLEAN DEFAULT FALSE
);

CREATE TABLE hostels (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    gender_restriction VARCHAR NOT NULL CHECK (gender_restriction IN ('male', 'female', 'mixed')),
    capacity INT DEFAULT 0
);

CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    hostel_id INT REFERENCES hostels(id) ON DELETE CASCADE,
    room_number VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'maintenance'))
);

CREATE TABLE beds (
    id SERIAL PRIMARY KEY,
    room_id INT REFERENCES rooms(id) ON DELETE CASCADE,
    bed_number INT NOT NULL,
    status VARCHAR DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'maintenance'))
);

CREATE TABLE mock_remita_payments (
    id SERIAL PRIMARY KEY,
    rrr VARCHAR(12) UNIQUE NOT NULL,
    status VARCHAR DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'used_for_allocation', 'used')),
    amount DECIMAL
);

CREATE TABLE allocations (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES users(id) ON DELETE CASCADE,
    bed_id INT REFERENCES beds(id) ON DELETE CASCADE,
    session_id INT REFERENCES academic_sessions(id) ON DELETE CASCADE,
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_id, session_id),
    UNIQUE(bed_id, session_id)
);

CREATE TABLE allocation_requests (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES users(id) ON DELETE CASCADE,
    choice_1_id INT,
    choice_2_id INT,
    choice_3_id INT,
    receipt_path VARCHAR,
    receipt_hash VARCHAR,
    extracted_rrr VARCHAR,
    status VARCHAR CHECK (status IN ('allocated', 'rejected')),
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION allocate_bed(p_student_id INT, p_choice_ids INT[], p_session_id INT)
RETURNS boolean AS $$
DECLARE
    v_bed_id INT;
    v_hostel_id INT;
BEGIN
    -- 1. Check if already allocated this session
    IF EXISTS (SELECT 1 FROM allocations WHERE student_id = p_student_id AND session_id = p_session_id) THEN
        RAISE EXCEPTION 'Student % already has an allocation for session %', p_student_id, p_session_id;
    END IF;

    -- 2. Loop choices to find bed (strictly atomic)
    FOR i IN 1 .. array_length(p_choice_ids, 1) LOOP
        v_hostel_id := p_choice_ids[i];
        
        -- SELECT FOR UPDATE SKIP LOCKED is the core concurrency handler
        SELECT b.id INTO v_bed_id
        FROM beds b
        JOIN rooms r ON b.room_id = r.id
        WHERE r.hostel_id = v_hostel_id 
          AND r.status = 'active'
          AND b.status = 'vacant'
        ORDER BY r.room_number, b.bed_number
        FOR UPDATE SKIP LOCKED
        LIMIT 1;

        IF v_bed_id IS NOT NULL THEN
            UPDATE beds SET status = 'occupied' WHERE id = v_bed_id;
            INSERT INTO allocations (student_id, bed_id, session_id)
            VALUES (p_student_id, v_bed_id, p_session_id);
            RETURN true;
        END IF;
    END LOOP;

    RAISE EXCEPTION 'No vacant beds found in any choices.';
END;
$$ LANGUAGE plpgsql;

-- INSERT INITIAL ADMIN AND ACADEMIC SESSION
INSERT INTO academic_sessions (session_name, is_active, allocation_portal_open) VALUES ('2025/2026', TRUE, TRUE);

