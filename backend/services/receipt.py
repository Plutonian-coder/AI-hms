"""
Receipt Service — Generate session-scoped HMS receipt references.

Format: HMS/YYYY/XXXXX where YYYY is from the session year and XXXXX is zero-padded sequential.
"""
from database import get_cursor


def generate_hms_reference(session_year: int) -> str:
    """
    Generate the next HMS receipt reference for the given session year.

    Args:
        session_year: The end year of the academic session (e.g. 2026 for 2025/2026)

    Returns:
        Reference string like HMS/2026/00001
    """
    prefix = f"HMS/{session_year}/"

    with get_cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM confirmed_payments WHERE hms_reference LIKE %s",
            (f"{prefix}%",),
        )
        count = cur.fetchone()[0]

    next_number = count + 1
    return f"{prefix}{next_number:05d}"
