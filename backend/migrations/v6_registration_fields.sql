-- V6: Add next-of-kin fields to users table
-- The columns department, level, email, phone already exist.

ALTER TABLE users ADD COLUMN IF NOT EXISTS next_of_kin_name VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS next_of_kin_phone VARCHAR(30);
