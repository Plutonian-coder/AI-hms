-- Migration: Add fee deadlines, fee types, and disability routing flags
-- Applied via admin/developer

-- 1. Add deadlines to academic_sessions
ALTER TABLE academic_sessions 
ADD COLUMN IF NOT EXISTS application_fee_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hostel_fee_deadline TIMESTAMPTZ;

-- 2. Add fee_type to fee_components
ALTER TABLE fee_components
ADD COLUMN IF NOT EXISTS fee_type VARCHAR(20) DEFAULT 'hostel';

-- Update existing fee components to be 'hostel' fees to maintain current behavior
UPDATE fee_components SET fee_type = 'hostel' WHERE fee_type IS NULL;

-- 3. Add disability_reserved to rooms
ALTER TABLE rooms
ADD COLUMN IF NOT EXISTS disability_reserved BOOLEAN DEFAULT FALSE;
