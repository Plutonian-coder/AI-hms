-- Migration: Add passport_photo_url column to users table
-- Stores the relative file path of the student's uploaded passport photo.
ALTER TABLE users ADD COLUMN IF NOT EXISTS passport_photo_url TEXT;
