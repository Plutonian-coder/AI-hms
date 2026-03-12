-- ============================================================
-- V5 Migration: Eligibility System, Paystack Payments, Checkout Tracking
-- Yabatech HMS - March 2026
-- Safe to run multiple times — uses IF NOT EXISTS / IF EXISTS
-- ============================================================

-- ── Step 1: Eligibility documents table ───────────────────────
-- Stores uploaded receipts for eligibility verification
-- Freshmen (ND1/HND1): acceptance_fee + e_screening
-- Returning (ND2/HND2): school_fees
CREATE TABLE IF NOT EXISTS eligibility_documents (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    document_type VARCHAR NOT NULL CHECK (document_type IN (
        'acceptance_fee', 'e_screening', 'school_fees'
    )),
    file_path VARCHAR NOT NULL,
    file_hash VARCHAR NOT NULL,
    extracted_identifier VARCHAR,
    ai_verdict VARCHAR DEFAULT 'pending' CHECK (ai_verdict IN (
        'pending', 'verified', 'rejected'
    )),
    rejection_reason TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    UNIQUE(student_id, session_id, document_type)
);

-- ── Step 2: Eligibility status (cached per student per session) ─
CREATE TABLE IF NOT EXISTS eligibility_status (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    is_eligible BOOLEAN DEFAULT FALSE,
    eligible_at TIMESTAMP,
    student_level VARCHAR,
    required_docs_submitted INT DEFAULT 0,
    required_docs_total INT NOT NULL,
    UNIQUE(student_id, session_id)
);

-- ── Step 3: Checkout/departure tracking ───────────────────────
CREATE TABLE IF NOT EXISTS checkouts (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    bed_id INT REFERENCES beds(id) ON DELETE SET NULL,
    hostel_name VARCHAR NOT NULL,
    block_name VARCHAR NOT NULL,
    room_number VARCHAR NOT NULL,
    bed_number INT NOT NULL,
    checkout_type VARCHAR NOT NULL CHECK (checkout_type IN (
        'voluntary', 'admin_revocation', 'session_expiry',
        'graduation', 'withdrawal', 'payment_expired'
    )),
    reason TEXT,
    recorded_by INT REFERENCES users(id),
    recorded_by_name VARCHAR,
    checked_out_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Step 4: Pending Paystack payments ─────────────────────────
CREATE TABLE IF NOT EXISTS pending_payments (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id INT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
    paystack_reference VARCHAR NOT NULL UNIQUE,
    choice_1_id INT NOT NULL,
    choice_2_id INT NOT NULL,
    choice_3_id INT NOT NULL,
    amount_kobo INT NOT NULL,
    status VARCHAR DEFAULT 'pending' CHECK (status IN (
        'pending', 'completed', 'failed', 'expired'
    )),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ── Step 5: Add columns to allocations table ──────────────────
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS paystack_reference VARCHAR;
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'active';

-- Add check constraint safely (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'allocations_status_check'
    ) THEN
        ALTER TABLE allocations ADD CONSTRAINT allocations_status_check
            CHECK (status IN ('active', 'checked_out', 'expired'));
    END IF;
END $$;

-- ── Step 6: Add eligibility_portal_open to academic_sessions ──
ALTER TABLE academic_sessions ADD COLUMN IF NOT EXISTS eligibility_portal_open BOOLEAN DEFAULT FALSE;

-- ── Step 7: Recreate allocate_bed() — now Paystack-aware ──────
-- Pay-first model: payment verified BEFORE allocation, so
-- payment_status is always 'validated' and no 7-day deadline needed
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[], INT);
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[], INT, VARCHAR);

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

-- ── Step 8: Session expiry function ───────────────────────────
-- Bulk-expires all active allocations for a session, creates
-- checkout records, and frees beds. Called when admin creates
-- a new session (old session ends).
CREATE OR REPLACE FUNCTION expire_session_allocations(p_session_id INT)
RETURNS INT AS $$
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

-- ── Step 9: Verification queries (run manually) ──────────────
-- \dt eligibility_documents
-- \dt eligibility_status
-- \dt checkouts
-- \dt pending_payments
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'allocations';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'academic_sessions';
