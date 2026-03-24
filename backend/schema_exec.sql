-- ============================================================================
-- Yabatech Hostel Management System — Full Schema (matches live Supabase DB)
-- ============================================================================

-- Drop in dependency order
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[], INT, VARCHAR);
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[], INT);
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[], VARCHAR);
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[]);
DROP FUNCTION IF EXISTS expire_session_allocations(INT);
DROP TABLE IF EXISTS checkouts CASCADE;
DROP TABLE IF EXISTS allocation_requests CASCADE;
DROP TABLE IF EXISTS allocations CASCADE;
DROP TABLE IF EXISTS pending_payments CASCADE;
DROP TABLE IF EXISTS eligibility_documents CASCADE;
DROP TABLE IF EXISTS eligibility_status CASCADE;
DROP TABLE IF EXISTS mock_remita_payments CASCADE;
DROP TABLE IF EXISTS beds CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS hostel_prices CASCADE;
DROP TABLE IF EXISTS hostels CASCADE;
DROP TABLE IF EXISTS academic_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ── Users ───────────────────────────────────────────────────────────────────
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_of_kin_name VARCHAR,
    next_of_kin_phone VARCHAR,
    study_mode VARCHAR DEFAULT 'full_time' CHECK (study_mode IN ('full_time', 'part_time'))
);

-- ── Academic Sessions ───────────────────────────────────────────────────────
CREATE TABLE academic_sessions (
    id SERIAL PRIMARY KEY,
    session_name VARCHAR UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    allocation_portal_open BOOLEAN DEFAULT FALSE,
    eligibility_portal_open BOOLEAN DEFAULT FALSE
);

-- ── Hostels ─────────────────────────────────────────────────────────────────
CREATE TABLE hostels (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    gender_restriction VARCHAR NOT NULL CHECK (gender_restriction IN ('male', 'female', 'mixed')),
    capacity INT DEFAULT 0,
    status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'decommissioned'))
);

-- ── Hostel Prices (per-hostel per-program pricing) ────────────────────────
CREATE TABLE hostel_prices (
    id SERIAL PRIMARY KEY,
    hostel_id INT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    program_type VARCHAR NOT NULL CHECK (program_type IN ('ND_FT', 'ND_PT', 'HND_FT', 'HND_PT')),
    amount INT NOT NULL,
    UNIQUE(hostel_id, program_type)
);

-- ── Blocks (hostel sub-divisions) ───────────────────────────────────────────
CREATE TABLE blocks (
    id SERIAL PRIMARY KEY,
    hostel_id INT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'maintenance'))
);

-- ── Rooms ───────────────────────────────────────────────────────────────────
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    block_id INT REFERENCES blocks(id) ON DELETE CASCADE,
    room_number VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'maintenance'))
);

-- ── Beds ────────────────────────────────────────────────────────────────────
CREATE TABLE beds (
    id SERIAL PRIMARY KEY,
    room_id INT REFERENCES rooms(id) ON DELETE CASCADE,
    bed_number INT NOT NULL,
    status VARCHAR DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'maintenance'))
);

-- ── Mock Remita Payments ────────────────────────────────────────────────────
CREATE TABLE mock_remita_payments (
    id SERIAL PRIMARY KEY,
    rrr VARCHAR(12) UNIQUE NOT NULL,
    status VARCHAR DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'used_for_allocation', 'used')),
    amount DECIMAL
);

-- ── Allocations ─────────────────────────────────────────────────────────────
CREATE TABLE allocations (
    id SERIAL PRIMARY KEY,
    student_id INT REFERENCES users(id) ON DELETE CASCADE,
    bed_id INT REFERENCES beds(id) ON DELETE CASCADE,
    session_id INT REFERENCES academic_sessions(id) ON DELETE CASCADE,
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_status VARCHAR DEFAULT 'pending',
    payment_deadline TIMESTAMP,
    paystack_reference VARCHAR,
    status VARCHAR DEFAULT 'active'
);

-- ── Allocation Requests (audit log) ─────────────────────────────────────────
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

-- ── Pending Payments (Paystack) ─────────────────────────────────────────────
CREATE TABLE pending_payments (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    paystack_reference VARCHAR NOT NULL,
    choice_1_id INT NOT NULL,
    choice_2_id INT NOT NULL,
    choice_3_id INT NOT NULL,
    amount_kobo INT NOT NULL,
    status VARCHAR DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ── Eligibility Documents ───────────────────────────────────────────────────
CREATE TABLE eligibility_documents (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    document_type VARCHAR NOT NULL,
    file_path VARCHAR NOT NULL,
    file_hash VARCHAR NOT NULL,
    extracted_identifier VARCHAR,
    extracted_rrr VARCHAR,
    extracted_name VARCHAR,
    ai_verdict VARCHAR DEFAULT 'pending',
    rejection_reason TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP
);

-- ── Eligibility Status ──────────────────────────────────────────────────────
CREATE TABLE eligibility_status (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    is_eligible BOOLEAN DEFAULT FALSE,
    eligible_at TIMESTAMP,
    student_level VARCHAR,
    required_docs_submitted INT DEFAULT 0,
    required_docs_total INT NOT NULL
);

-- ── Checkouts ───────────────────────────────────────────────────────────────
CREATE TABLE checkouts (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    bed_id INT REFERENCES beds(id),
    hostel_name VARCHAR NOT NULL,
    block_name VARCHAR NOT NULL,
    room_number VARCHAR NOT NULL,
    bed_number INT NOT NULL,
    checkout_type VARCHAR NOT NULL,
    reason TEXT,
    recorded_by INT,
    recorded_by_name VARCHAR,
    checked_out_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Atomic bed allocation with concurrency control
CREATE OR REPLACE FUNCTION allocate_bed(
    p_student_id INT,
    p_choice_ids INT[],
    p_session_id INT,
    p_paystack_ref VARCHAR DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
    v_bed_id INT;
    v_hostel_id INT;
BEGIN
    -- Check if already allocated this session (only active allocations)
    IF EXISTS (
        SELECT 1 FROM allocations
        WHERE student_id = p_student_id
          AND session_id = p_session_id
          AND status = 'active'
    ) THEN
        RAISE EXCEPTION 'Student % already has an allocation for session %', p_student_id, p_session_id;
    END IF;

    -- Loop through hostel choices to find a vacant bed
    FOR i IN 1 .. array_length(p_choice_ids, 1) LOOP
        v_hostel_id := p_choice_ids[i];

        SELECT b.id INTO v_bed_id
        FROM beds b
        JOIN rooms r    ON b.room_id  = r.id
        JOIN blocks bl  ON r.block_id = bl.id
        JOIN hostels h  ON bl.hostel_id = h.id
        WHERE bl.hostel_id = v_hostel_id
          AND h.status  = 'active'
          AND bl.status = 'active'
          AND r.status  = 'active'
          AND b.status  = 'vacant'
        ORDER BY bl.name, r.room_number, b.bed_number
        FOR UPDATE SKIP LOCKED
        LIMIT 1;

        IF v_bed_id IS NOT NULL THEN
            UPDATE beds SET status = 'occupied' WHERE id = v_bed_id;
            INSERT INTO allocations (
                student_id, bed_id, session_id,
                payment_status, paystack_reference, status
            ) VALUES (
                p_student_id, v_bed_id, p_session_id,
                'validated', p_paystack_ref, 'active'
            );
            RETURN true;
        END IF;
    END LOOP;

    RAISE EXCEPTION 'No vacant beds found in any chosen hostels.';
END;
$$ LANGUAGE plpgsql;


-- Expire all allocations when a session ends
CREATE OR REPLACE FUNCTION expire_session_allocations(p_session_id INT)
RETURNS integer AS $$
DECLARE
    v_count INT;
BEGIN
    -- Insert checkout records for all active allocations
    INSERT INTO checkouts (
        student_id, session_id, bed_id,
        hostel_name, block_name, room_number, bed_number,
        checkout_type, reason, recorded_by_name
    )
    SELECT
        a.student_id, a.session_id, a.bed_id,
        h.name, bl.name, r.room_number, b.bed_number,
        'session_expiry', 'Academic session ended', 'SYSTEM'
    FROM allocations a
    JOIN beds b     ON b.id  = a.bed_id
    JOIN rooms r    ON r.id  = b.room_id
    JOIN blocks bl  ON bl.id = r.block_id
    JOIN hostels h  ON h.id  = bl.hostel_id
    WHERE a.session_id = p_session_id
      AND (a.status = 'active' OR a.status IS NULL);

    -- Free all occupied beds
    UPDATE beds SET status = 'vacant'
    WHERE id IN (
        SELECT bed_id FROM allocations
        WHERE session_id = p_session_id
          AND (status = 'active' OR status IS NULL)
    );

    -- Mark allocations as expired
    UPDATE allocations SET status = 'expired'
    WHERE session_id = p_session_id
      AND (status = 'active' OR status IS NULL);

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ── Seed Data ───────────────────────────────────────────────────────────────
INSERT INTO academic_sessions (session_name, is_active, allocation_portal_open, eligibility_portal_open)
VALUES ('2025/2026', TRUE, TRUE, FALSE);
