-- V2 Migration: Add missing columns and tables
-- Safe to run multiple times — uses IF NOT EXISTS / IF EXISTS checks
-- Run this instead of re-running schema_exec.sql

-- 1. Add missing columns to users (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='department') THEN
        ALTER TABLE users ADD COLUMN department VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='level') THEN
        ALTER TABLE users ADD COLUMN level VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='email') THEN
        ALTER TABLE users ADD COLUMN email VARCHAR;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR;
    END IF;
END $$;

-- 2. Create allocation_requests table (only if it doesn't exist)
CREATE TABLE IF NOT EXISTS allocation_requests (
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

-- Done!
-- This migration is SAFE — it won't drop or overwrite any existing data.
