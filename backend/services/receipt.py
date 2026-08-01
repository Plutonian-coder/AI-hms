"""
Receipt Service — Generate session-scoped FUOYE receipt references.

Format: FUOYE/YYYY/XXXXX where YYYY is from the session year and XXXXX is zero-padded sequential.
"""
import re

from database import get_cursor


def session_year(session_name: str, year_end=None) -> int:
    """
    Year to stamp on a receipt: the session's end year.

    Sessions created through the UI only carry a name, leaving year_end NULL, so
    fall back to parsing '2024/2025' rather than a hardcoded constant — that
    fallback was stamping current-year references onto older sessions.
    """
    if year_end:
        return int(year_end)
    m = re.match(r"\s*(\d{4})\s*/\s*(\d{4})", session_name or "")
    if m:
        return int(m.group(2))
    m = re.match(r"\s*(\d{4})", session_name or "")
    if m:
        return int(m.group(1)) + 1
    from datetime import datetime
    return datetime.now().year


def generate_hms_reference(year: int) -> str:
    """
    Next FUOYE receipt reference for the given year.

    Derived from the highest existing number, never from a row count. Pending
    payments are deleted when an attempt is abandoned, so counting rows produced
    a number that was already taken — e.g. with FUOYE/2026/00002 and
    FUOYE/2026/00003 on file, COUNT+1 returns 00003 and the insert fails on the
    unique constraint. An advisory lock serialises concurrent callers so two
    students checking out at once can't be handed the same reference.
    """
    prefix = f"FUOYE/{year}/"

    with get_cursor() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (prefix,))
        cur.execute(
            """SELECT COALESCE(MAX(NULLIF(regexp_replace(
                          split_part(hms_reference, '/', 3), '\\D', '', 'g'), '')::bigint), 0)
               FROM confirmed_payments
               WHERE hms_reference LIKE %s""",
            (f"{prefix}%",),
        )
        highest = cur.fetchone()[0] or 0

    return f"{prefix}{highest + 1:05d}"
