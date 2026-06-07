-- ============================================================================
-- HMS v4 Migration — Enterprise Application Pipeline
-- Additive migration — no destructive changes to existing data.
-- ============================================================================

-- 1. Drop the old CHECK constraint on hostel_applications.status
ALTER TABLE hostel_applications
  DROP CONSTRAINT IF EXISTS hostel_applications_status_check;

-- 2. Add the expanded status CHECK constraint
ALTER TABLE hostel_applications
  ADD CONSTRAINT hostel_applications_status_check
  CHECK (status IN (
    'draft',
    'submitted',
    'pending_verification',
    'medical_approved',
    'medical_rejected',
    'ready_for_allocation',
    'allocated',
    'paid',
    'cancelled'
  ));

-- 3. Add new pipeline columns
ALTER TABLE hostel_applications
  ADD COLUMN IF NOT EXISTS has_special_needs BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS special_needs_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS medical_doc_path TEXT,
  ADD COLUMN IF NOT EXISTS medical_doc_original_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS medical_reviewed_by INT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS medical_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS medical_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS upload_attempt INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage_completed INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_status_note TEXT,
  ADD COLUMN IF NOT EXISTS admin_status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_status_updated_by INT REFERENCES users(id);

-- 4. Migrate existing data — mark old applications as having completed all stages
UPDATE hostel_applications
  SET stage_completed = 3
  WHERE status IN ('submitted', 'paid', 'allocated')
    AND (stage_completed IS NULL OR stage_completed = 0);

-- 5. Transition old 'submitted' (no special needs) to 'ready_for_allocation'
UPDATE hostel_applications
  SET status = 'ready_for_allocation'
  WHERE status = 'submitted'
    AND (has_special_needs IS NULL OR has_special_needs = FALSE);

-- 6. Index for admin review queue performance
CREATE INDEX IF NOT EXISTS idx_applications_status
  ON hostel_applications(status);

CREATE INDEX IF NOT EXISTS idx_applications_session_status
  ON hostel_applications(session_id, status);
