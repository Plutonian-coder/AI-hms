-- Migration v7: Physical Check-In and Key Issuance Support
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS checked_in BOOLEAN DEFAULT FALSE;
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP;
ALTER TABLE allocations ADD COLUMN IF NOT EXISTS checked_in_by VARCHAR(50);
