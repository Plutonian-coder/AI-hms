-- ═══════════════════════════════════════════════════════════════════════════
-- v8 — Repair two production defects introduced by the Supabase -> AWS RDS
--      migration and by unguarded session activation.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Resync every identity sequence ──────────────────────────────────────
-- import_to_aws.py replayed a data dump containing explicit id values, which
-- does NOT advance the underlying sequences. Every sequence was left at 1, so
-- the next INSERT collides with an imported row:
--     duplicate key value violates unique constraint "fee_components_pkey"
--     DETAIL: Key (id)=(5) already exists.
-- This hits every imported table, not just fee_components.

DO $$
DECLARE
    r      RECORD;
    seq    TEXT;
    maxid  BIGINT;
BEGIN
    FOR r IN
        SELECT c.table_name, c.column_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_name   = c.table_name
         AND t.table_schema = c.table_schema
        WHERE c.table_schema = 'public'
          AND t.table_type   = 'BASE TABLE'
          AND c.column_name  = 'id'
    LOOP
        seq := pg_get_serial_sequence(format('public.%I', r.table_name), r.column_name);
        IF seq IS NOT NULL THEN
            EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM public.%I', r.column_name, r.table_name)
                INTO maxid;
            -- is_called = false, so the next value handed out is exactly maxid + 1
            PERFORM setval(seq, maxid + 1, false);
            RAISE NOTICE 'sequence % reset to %', seq, maxid + 1;
        END IF;
    END LOOP;
END $$;


-- ── 2. Collapse multiple active sessions down to one ───────────────────────
-- Only one academic session may be active. The API's deactivation queries used
-- `WHERE is_active = TRUE LIMIT 1`, so once two rows were active the state
-- could never converge. Keep the newest (highest id); retire the rest.

UPDATE academic_sessions
SET is_active               = FALSE,
    application_portal_open = FALSE,
    payment_portal_open     = FALSE,
    allocation_portal_open  = FALSE,
    register_import_open    = FALSE
WHERE is_active = TRUE
  AND id <> (SELECT MAX(id) FROM academic_sessions WHERE is_active = TRUE);


-- ── 3. Make the "one active session" rule structural ───────────────────────
-- A partial unique index over the single TRUE value: Postgres will now reject
-- any second active session outright, so application-layer bugs can no longer
-- reintroduce this state.

CREATE UNIQUE INDEX IF NOT EXISTS one_active_session
    ON academic_sessions ((is_active))
    WHERE is_active = TRUE;
