-- ═══════════════════════════════════════════════════════════════════════════
-- v9 — Backfill academic_sessions.year_start / year_end from the session name.
--
-- Sessions created through the admin UI only carried a name, leaving both year
-- columns NULL. Receipt reference generation falls back on those years, so a
-- 2024/2025 session was stamping references as FUOYE/2026/... — the current
-- calendar year rather than the session's own.
--
-- Safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE academic_sessions
SET year_start = COALESCE(year_start, NULLIF(substring(session_name FROM '^(\d{4})'), '')::int),
    year_end   = COALESCE(year_end,   NULLIF(substring(session_name FROM '^\d{4}\s*/\s*(\d{4})'), '')::int)
WHERE year_start IS NULL OR year_end IS NULL;
