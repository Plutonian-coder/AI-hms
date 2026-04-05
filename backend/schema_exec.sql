-- ============================================================================
-- HMS — AI-Driven Hostel Management System — Full Schema
-- Session Register + Compatibility Matching + Multi-Component Fees
-- ============================================================================

-- Drop in dependency order
DROP FUNCTION IF EXISTS allocate_specific_bed(INT, INT, INT, INT, INT, DECIMAL);
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[], INT, VARCHAR);
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[], INT);
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[], VARCHAR);
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[]);
DROP FUNCTION IF EXISTS expire_session_allocations(INT);

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS compatibility_scores CASCADE;
DROP TABLE IF EXISTS payment_component_log CASCADE;
DROP TABLE IF EXISTS confirmed_payments CASCADE;
DROP TABLE IF EXISTS student_vectors CASCADE;
DROP TABLE IF EXISTS hostel_applications CASCADE;
DROP TABLE IF EXISTS fee_components CASCADE;
DROP TABLE IF EXISTS session_register CASCADE;
DROP TABLE IF EXISTS allocations CASCADE;
DROP TABLE IF EXISTS beds CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS blocks CASCADE;
DROP TABLE IF EXISTS hostels CASCADE;
DROP TABLE IF EXISTS academic_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Also drop legacy tables if they exist
DROP TABLE IF EXISTS checkouts CASCADE;
DROP TABLE IF EXISTS allocation_requests CASCADE;
DROP TABLE IF EXISTS pending_payments CASCADE;
DROP TABLE IF EXISTS eligibility_documents CASCADE;
DROP TABLE IF EXISTS eligibility_status CASCADE;
DROP TABLE IF EXISTS mock_remita_payments CASCADE;
DROP TABLE IF EXISTS hostel_prices CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Users ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(50) UNIQUE NOT NULL,          -- matric number or admin ID
    surname VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    department VARCHAR(100),
    level VARCHAR(10),                               -- 100L-500L (university mode)
    study_type VARCHAR(20) DEFAULT 'Full-time' CHECK (study_type IN ('Full-time', 'Part-time', 'Sandwich')),
    role VARCHAR(10) NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
    next_of_kin_name VARCHAR(150),
    next_of_kin_phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Academic Sessions ───────────────────────────────────────────────────────
CREATE TABLE academic_sessions (
    id SERIAL PRIMARY KEY,
    session_name VARCHAR(20) UNIQUE NOT NULL,         -- e.g. 2025/2026
    year_start INT,                                   -- e.g. 2025
    year_end INT,                                     -- e.g. 2026
    eligible_levels TEXT[] DEFAULT '{}',               -- e.g. {100L,200L,300L,400L,500L}
    is_active BOOLEAN DEFAULT FALSE,
    application_portal_open BOOLEAN DEFAULT FALSE,
    payment_portal_open BOOLEAN DEFAULT FALSE,
    allocation_portal_open BOOLEAN DEFAULT FALSE,
    register_import_open BOOLEAN DEFAULT FALSE,
    session_ended BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Session Register (CSV import of enrolled students) ──────────────────────
CREATE TABLE session_register (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    matric_number VARCHAR(50) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('male', 'female')),
    department VARCHAR(100),
    level VARCHAR(10),
    study_type VARCHAR(20) DEFAULT 'Full-time',
    faculty VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, matric_number)
);

-- ── Hostels ─────────────────────────────────────────────────────────────────
CREATE TABLE hostels (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    gender_restriction VARCHAR(10) NOT NULL CHECK (gender_restriction IN ('male', 'female', 'mixed')),
    capacity INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'decommissioned'))
);

-- ── Blocks (hostel sub-divisions) ───────────────────────────────────────────
CREATE TABLE blocks (
    id SERIAL PRIMARY KEY,
    hostel_id INT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance'))
);

-- ── Rooms ───────────────────────────────────────────────────────────────────
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    block_id INT REFERENCES blocks(id) ON DELETE CASCADE,
    room_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'maintenance'))
);

-- ── Beds ────────────────────────────────────────────────────────────────────
CREATE TABLE beds (
    id SERIAL PRIMARY KEY,
    room_id INT REFERENCES rooms(id) ON DELETE CASCADE,
    bed_number INT NOT NULL,
    status VARCHAR(20) DEFAULT 'vacant' CHECK (status IN ('vacant', 'occupied', 'maintenance'))
);

-- ── Fee Components (multi-component fee builder per session) ────────────────
CREATE TABLE fee_components (
    id SERIAL PRIMARY KEY,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,                      -- e.g. Accommodation, Electricity Levy
    amount_fulltime INT NOT NULL DEFAULT 0,          -- amount in kobo for full-time
    amount_parttime INT NOT NULL DEFAULT 0,          -- amount in kobo for part-time
    amount_sandwich INT NOT NULL DEFAULT 0,          -- amount in kobo for sandwich
    applies_to VARCHAR(20) DEFAULT 'all' CHECK (applies_to IN ('all', 'fulltime_only', 'parttime_only', 'sandwich_only', 'freshers_only')),
    is_mandatory BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0
);

-- ── Hostel Applications ─────────────────────────────────────────────────────
CREATE TABLE hostel_applications (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    choice_1_id INT REFERENCES hostels(id),
    choice_2_id INT REFERENCES hostels(id),
    choice_3_id INT REFERENCES hostels(id),
    special_notes TEXT,
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted', 'paid', 'allocated', 'cancelled')),
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, session_id)
);

-- ── Confirmed Payments ──────────────────────────────────────────────────────
CREATE TABLE confirmed_payments (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    hms_reference VARCHAR(20) UNIQUE NOT NULL,       -- HMS/YYYY/XXXXX
    paystack_id VARCHAR(100),
    total_amount_kobo INT NOT NULL,
    payment_channel VARCHAR(30),                     -- card, bank_transfer, ussd, etc.
    paystack_status VARCHAR(20),                     -- success, abandoned, failed
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('confirmed', 'pending', 'failed', 'reversed')),
    confirmed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, session_id)
);

-- ── Payment Component Log (itemized receipt breakdown) ──────────────────────
CREATE TABLE payment_component_log (
    id SERIAL PRIMARY KEY,
    payment_id INT NOT NULL REFERENCES confirmed_payments(id) ON DELETE CASCADE,
    component_id INT REFERENCES fee_components(id),
    component_name VARCHAR(100) NOT NULL,
    amount_kobo INT NOT NULL
);

-- ── Student Vectors (compatibility questionnaire responses) ─────────────────
CREATE TABLE student_vectors (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    v1 DECIMAL(3,2) DEFAULT 0.0,  -- Sleep time
    v2 DECIMAL(3,2) DEFAULT 0.0,  -- Wake time
    v3 DECIMAL(3,2) DEFAULT 0.0,  -- Study noise preference
    v4 DECIMAL(3,2) DEFAULT 0.0,  -- Cleanliness
    v5 DECIMAL(3,2) DEFAULT 0.0,  -- Visitor frequency
    v6 DECIMAL(3,2) DEFAULT 0.0,  -- Night device use
    v7 DECIMAL(3,2) DEFAULT 0.0,  -- Social preference
    v8 DECIMAL(3,2) DEFAULT 0.0,  -- Noise tolerance
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, session_id)
);

-- ── Allocations ─────────────────────────────────────────────────────────────
CREATE TABLE allocations (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bed_id INT NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    payment_id INT REFERENCES confirmed_payments(id),
    matched_from_preference INT,                     -- 1, 2, or 3
    avg_compatibility_score DECIMAL(5,2),            -- percentage 0-100
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    revocation_reason VARCHAR(100),
    revoked_by VARCHAR(50),
    revoked_at TIMESTAMPTZ,
    allocated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Compatibility Scores (pairwise roommate scores) ─────────────────────────
CREATE TABLE compatibility_scores (
    id SERIAL PRIMARY KEY,
    student_a_id INT NOT NULL REFERENCES users(id),
    student_b_id INT NOT NULL REFERENCES users(id),
    session_id INT NOT NULL REFERENCES academic_sessions(id),
    score DECIMAL(5,2) NOT NULL,                     -- 0-100 percentage
    computed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_a_id, student_b_id, session_id)
);

-- ── Audit Logs (append-only, immutable) ─────────────────────────────────────
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_type VARCHAR(20) NOT NULL CHECK (actor_type IN ('student', 'admin', 'system', 'paystack')),
    actor_id VARCHAR(50) NOT NULL,                   -- matric number, admin ID, SYSTEM, PAYSTACK_WEBHOOK
    action_type VARCHAR(50) NOT NULL,                -- standardised action code
    target_entity VARCHAR(50),                       -- allocation, payment, user, session, bed, etc.
    target_id VARCHAR(50),
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    session_id INT REFERENCES academic_sessions(id)
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_session ON audit_logs(session_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- Atomic bed allocation — locks a specific bed and creates the allocation record.
-- Compatibility scoring is computed in Python; this function handles the atomic DB operations.
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

    -- Lock the specific bed with SKIP LOCKED (returns NULL if already locked by another tx)
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
    )
    RETURNING id INTO v_allocation_id;

    RETURN v_allocation_id;
END;
$$ LANGUAGE plpgsql;


-- Expire all allocations when a session ends
CREATE OR REPLACE FUNCTION expire_session_allocations(p_session_id INT)
RETURNS integer AS $$
DECLARE
    v_count INT;
BEGIN
    -- Free all occupied beds for this session's active allocations
    UPDATE beds SET status = 'vacant'
    WHERE id IN (
        SELECT bed_id FROM allocations
        WHERE session_id = p_session_id AND status = 'active'
    );

    -- Mark allocations as expired
    UPDATE allocations SET status = 'expired'
    WHERE session_id = p_session_id AND status = 'active';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;


-- ── Seed Data ───────────────────────────────────────────────────────────────
INSERT INTO academic_sessions (
    session_name, year_start, year_end, eligible_levels,
    is_active, application_portal_open, payment_portal_open,
    allocation_portal_open, register_import_open
) VALUES (
    '2025/2026', 2025, 2026,
    ARRAY['100L','200L','300L','400L','500L'],
    TRUE, FALSE, FALSE, FALSE, FALSE
);

-- ── Admin Account Seed ──────────────────────────────────────────────────────
-- Login: ADMIN001 / Admin@2026
INSERT INTO users (identifier, surname, first_name, gender, password_hash, role)
VALUES ('ADMIN001', 'System', 'Administrator', 'male', '$2b$12$1Peh6hUg/pV93x/pNv9Yqe3kLmKxCuOawDV392sCdqZIhShLWlaGq', 'admin')
ON CONFLICT (identifier) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = 'admin';
