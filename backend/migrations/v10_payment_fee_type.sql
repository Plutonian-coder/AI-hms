-- ═══════════════════════════════════════════════════════════════════════════
-- v10 — Allow one payment per fee type per session.
--
-- confirmed_payments carried UNIQUE(student_id, session_id), which permits only
-- ONE payment row per student per session. But the portal charges two separate
-- fees in a session — the application fee up front, then the hostel fee after
-- allocation — so every student's second checkout died with:
--     duplicate key value violates unique constraint
--     "confirmed_payments_student_id_session_id_key"
--
-- The fix widens the key to include fee_type, which is now stored on the row.
-- Storing it also retires the guess in _confirm_payment_internal, which used to
-- infer the fee type by matching total_amount_kobo against both computed fees —
-- and mislabelled the payment whenever the two totals happened to be equal.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Add the column ──────────────────────────────────────────────────────
ALTER TABLE confirmed_payments
    ADD COLUMN IF NOT EXISTS fee_type VARCHAR(20);


-- ── 2. Backfill from the itemized component log ────────────────────────────
-- Confirmed payments have component rows recorded against them; those name the
-- fee type authoritatively.
UPDATE confirmed_payments cp
SET fee_type = sub.fee_type
FROM (
    SELECT DISTINCT ON (pcl.payment_id) pcl.payment_id, fc.fee_type
    FROM payment_component_log pcl
    JOIN fee_components fc ON fc.id = pcl.component_id
    ORDER BY pcl.payment_id, fc.fee_type
) sub
WHERE sub.payment_id = cp.id
  AND cp.fee_type IS NULL;

-- Pending and failed rows never got component logs. The application fee is the
-- first thing a student pays, so it is the safe assumption for the remainder.
UPDATE confirmed_payments
SET fee_type = 'application'
WHERE fee_type IS NULL;


-- ── 3. Constrain the column ────────────────────────────────────────────────
ALTER TABLE confirmed_payments
    ALTER COLUMN fee_type SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'confirmed_payments_fee_type_check'
          AND conrelid = 'confirmed_payments'::regclass
    ) THEN
        ALTER TABLE confirmed_payments
            ADD CONSTRAINT confirmed_payments_fee_type_check
            CHECK (fee_type IN ('application', 'hostel'));
    END IF;
END $$;


-- ── 4. Swap the uniqueness key ─────────────────────────────────────────────
-- Out with one-payment-per-session, in with one-payment-per-fee-per-session.
ALTER TABLE confirmed_payments
    DROP CONSTRAINT IF EXISTS confirmed_payments_student_id_session_id_key;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'confirmed_payments_student_session_fee_key'
          AND conrelid = 'confirmed_payments'::regclass
    ) THEN
        ALTER TABLE confirmed_payments
            ADD CONSTRAINT confirmed_payments_student_session_fee_key
            UNIQUE (student_id, session_id, fee_type);
    END IF;
END $$;
