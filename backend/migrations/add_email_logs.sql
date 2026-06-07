-- ============================================================================
-- Migration: Add email_logs table + session_register.email column
-- ============================================================================

-- New table to track every email sent by the system
CREATE TABLE IF NOT EXISTS email_logs (
    id BIGSERIAL PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(200),
    recipient_matric VARCHAR(50),
    recipient_user_id INT REFERENCES users(id),
    subject VARCHAR(500) NOT NULL,
    body_preview TEXT,
    email_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    session_id INT REFERENCES academic_sessions(id),
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_logs_matric ON email_logs(recipient_matric);
CREATE INDEX IF NOT EXISTS idx_email_logs_type ON email_logs(email_type);
CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC);

-- Add email column to session_register for CSV imports
ALTER TABLE session_register ADD COLUMN IF NOT EXISTS email VARCHAR(150);
