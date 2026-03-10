-- ============================================================
-- v4: Drop Supabase Auth dependency → Self-managed JWT Auth
-- ============================================================
-- Run this in the Supabase SQL Editor.
--
-- What this does:
--   1. Wipes all existing users (they had placeholder 'supabase_auth'
--      hashes which are invalid for bcrypt — everyone must re-register)
--   2. Wipes dependent auth data (allocations, requests)
--   3. Resets all identity sequences back to 1
--   4. Confirms password_hash column exists (it does — no ALTER needed)
--
-- After running this migration:
--   - All students re-register via the app (takes 30 seconds)
--   - Create your admin user with the SQL INSERT below
-- ============================================================

-- Step 1: Wipe auth ghost records from Supabase's internal auth system
-- (prevents "email already registered" errors on re-registration)
DELETE FROM auth.users;

-- Step 2: Wipe application data in dependency order
TRUNCATE TABLE
    allocation_requests,
    allocations,
    mock_remita_payments,
    users
RESTART IDENTITY CASCADE;

-- Step 3: Verify the password_hash column exists and is ready
-- (it already does from schema_exec.sql — this is just a sanity check)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'password_hash'
    ) THEN
        RAISE EXCEPTION 'password_hash column missing from users table — re-run schema_exec.sql first';
    END IF;
    RAISE NOTICE 'Migration v4: users table is ready for bcrypt hashes.';
END $$;


-- ============================================================
-- AFTER MIGRATION: Create your first admin account
-- ============================================================
-- Replace the values below with real credentials.
-- The password below is bcrypt-hashed. To generate your own hash:
--
--   python -c "from passlib.context import CryptContext; \
--              ctx = CryptContext(schemes=['bcrypt'], bcrypt__rounds=12); \
--              print(ctx.hash('YourAdminPassword123'))"
--
-- Then paste the output as the password_hash value below.
--
-- Example (password = "AdminPass123"):

-- INSERT INTO users (identifier, surname, first_name, gender, role, password_hash)
-- VALUES (
--     'ADMIN001',
--     'AdminSurname',
--     'AdminFirstName',
--     'male',
--     'admin',
--     '$2b$12$REPLACE_WITH_YOUR_BCRYPT_HASH_HERE'
-- );


-- ============================================================
-- ROLE MANAGEMENT QUERIES (use anytime)
-- ============================================================

-- Promote a registered student to admin (takes effect on their next login):
-- UPDATE users SET role = 'admin' WHERE identifier = 'YCT/FE/22/00123';

-- Demote an admin back to student:
-- UPDATE users SET role = 'student' WHERE identifier = 'YCT/FE/22/00123';

-- View all users and their current roles:
-- SELECT id, identifier, surname, first_name, role, created_at FROM users ORDER BY created_at DESC;
