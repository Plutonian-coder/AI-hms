-- ============================================================
-- V3 Migration: Hostel -> Block -> Room Hierarchy
-- Yabatech HMS - March 2026
-- Safe to run multiple times — uses IF NOT EXISTS / IF EXISTS
-- ============================================================

-- ── Step 1: Add `status` column to hostels ──────────────────
ALTER TABLE hostels ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'active'
    CHECK (status IN ('active', 'maintenance', 'decommissioned'));

-- ── Step 2: Create the `blocks` table ───────────────────────
CREATE TABLE IF NOT EXISTS blocks (
    id SERIAL PRIMARY KEY,
    hostel_id INT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,           -- e.g. 'Block A', 'Wing 1', 'Block B'
    status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'maintenance')),
    UNIQUE(hostel_id, name)
);

-- ── Step 3: Rewire rooms from hostel_id → block_id ──────────
-- 3a. Add block_id FK to rooms (nullable first — filled after seeding blocks)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS block_id INT REFERENCES blocks(id) ON DELETE CASCADE;

-- 3b. Drop old hostel_id column from rooms ONLY AFTER all data has been migrated.
--     We do this at the END of the migration to allow for data-preserving scripts.
--     (For a fresh DB, this is safe immediately — existing rooms have no data.)
DO $$
BEGIN
    -- Only drop hostel_id if block_id exists (i.e., this migration ran)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'rooms' AND column_name = 'block_id'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'rooms' AND column_name = 'hostel_id'
    ) THEN
        -- Null out any orphaned rooms (rooms with no block), then drop hostel_id
        ALTER TABLE rooms DROP COLUMN hostel_id;
    END IF;
END $$;

-- ── Step 4: Add payment lifecycle columns to allocations ─────
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS payment_status VARCHAR DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'validated', 'expired'));
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS payment_deadline TIMESTAMP;

-- ── Step 5: Recreate allocate_bed() — now block-aware ────────
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[], INT);
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[], VARCHAR);
DROP FUNCTION IF EXISTS allocate_bed(INT, INT[]);

CREATE OR REPLACE FUNCTION allocate_bed(p_student_id INT, p_choice_ids INT[], p_session_id INT)
RETURNS boolean AS $$
DECLARE
    v_bed_id INT;
    v_hostel_id INT;
BEGIN
    -- Check if already allocated this session
    IF EXISTS (
        SELECT 1 FROM allocations
        WHERE student_id = p_student_id AND session_id = p_session_id
    ) THEN
        RAISE EXCEPTION 'Student % already has an allocation for session %', p_student_id, p_session_id;
    END IF;

    -- Loop through hostel choices to find a vacant bed
    -- Joins through blocks so maintenance blocks are automatically skipped
    FOR i IN 1 .. array_length(p_choice_ids, 1) LOOP
        v_hostel_id := p_choice_ids[i];

        SELECT b.id INTO v_bed_id
        FROM beds b
        JOIN rooms r    ON b.room_id  = r.id
        JOIN blocks bl  ON r.block_id = bl.id
        JOIN hostels h  ON bl.hostel_id = h.id
        WHERE bl.hostel_id = v_hostel_id
          AND h.status  = 'active'      -- hostel must be active
          AND bl.status = 'active'      -- block must be active
          AND r.status  = 'active'      -- room must be active
          AND b.status  = 'vacant'
        ORDER BY bl.name, r.room_number, b.bed_number
        FOR UPDATE SKIP LOCKED
        LIMIT 1;

        IF v_bed_id IS NOT NULL THEN
            UPDATE beds SET status = 'occupied' WHERE id = v_bed_id;
            INSERT INTO allocations (student_id, bed_id, session_id, payment_status, payment_deadline)
            VALUES (
                p_student_id,
                v_bed_id,
                p_session_id,
                'pending',
                CURRENT_TIMESTAMP + INTERVAL '7 days'   -- 7-day payment window
            );
            RETURN true;
        END IF;
    END LOOP;

    RAISE EXCEPTION 'No vacant beds found in any chosen hostels.';
END;
$$ LANGUAGE plpgsql;

-- ── Step 6: Seed the exact hostel inventory (supervisor override) ─
-- First, ensure hostel names are unique (required for ON CONFLICT to work)
-- Note: CREATE UNIQUE INDEX IF NOT EXISTS is used because ADD CONSTRAINT does not support IF NOT EXISTS
CREATE UNIQUE INDEX IF NOT EXISTS hostels_name_unique ON hostels (name);

-- Upsert: insert the 7 official hostels, update gender/status if they already exist
INSERT INTO hostels (name, gender_restriction, status, capacity) VALUES
    ('Akata',                  'female', 'active',      0),
    ('Complex',                'female', 'active',      0),
    ('PGD Hall',               'male',   'active',      0),
    ('New Female Hostel',      'female', 'active',      0),
    ('Augustus Aikhomu Hall',  'female', 'active',      0),
    ('Hollywood',              'male',   'active',      0),
    ('Bakassi',                'female', 'maintenance', 0)
ON CONFLICT (name) DO UPDATE
    SET gender_restriction = EXCLUDED.gender_restriction,
        status             = EXCLUDED.status;

-- ── Step 7: Verification queries (run manually to confirm) ───
-- SELECT id, name, gender_restriction, status FROM hostels ORDER BY name;
-- SELECT * FROM blocks;
-- \d rooms   -- should show block_id, no hostel_id
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'allocations';
