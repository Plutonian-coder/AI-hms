"""
Register Import Router — CSV upload of enrolled students per session.

Admin uploads a CSV with columns: matric_number, surname, first_name, gender,
department, level, study_type, faculty (optional).
The system validates, previews, and imports into session_register.
"""
import csv
import io
import logging
import re

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from database import get_cursor, get_connection
from dependencies import get_current_admin
from services.audit_logger import log_event, REGISTER_IMPORTED
from services.email import send_student_invite_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/register", tags=["register_import"])

REQUIRED_COLUMNS = {"matric_number", "surname", "first_name", "gender", "department", "level", "study_type", "email"}
VALID_GENDERS = {"male", "female"}
VALID_STUDY_TYPES = {"Full-time", "Part-time", "CODFEL"}


def _get_active_session(cur):
    cur.execute("SELECT id, session_name, register_import_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
    return cur.fetchone()


def _students_missing_invite(cur, session_id: int):
    """
    Register entries for this session with no successfully-sent invite.

    Derived from email_logs rather than from whether a given INSERT was new, so
    it stays correct across re-uploads, partial sends and worker restarts — and
    it is naturally idempotent, so retrying can never double-mail anyone.
    """
    cur.execute(
        """SELECT r.matric_number, r.first_name, r.email
           FROM session_register r
           WHERE r.session_id = %s
             AND COALESCE(r.email, '') <> ''
             AND NOT EXISTS (
                 SELECT 1 FROM email_logs l
                 WHERE l.recipient_matric = r.matric_number
                   AND l.email_type = 'student_invite'
                   AND l.status = 'sent'
             )
           ORDER BY r.matric_number""",
        (session_id,),
    )
    return cur.fetchall()


def _send_invites(students, session_name: str, session_id: int):
    """
    Send invites and report how many actually landed.

    Deliberately synchronous. These previously went out on a daemon thread so
    the response could return immediately, but that thread is killed whenever
    the worker is recycled or the instance spins down — which is why a 26-row
    import delivered zero emails. Sending inline costs a slower request but the
    count returned is the truth, and anything missed is retryable.
    """
    sent = failed = 0
    for matric, first_name, email in students:
        try:
            ok = send_student_invite_email(
                to_email=email,
                first_name=first_name,
                matric_number=matric,
                session_name=session_name,
                session_id=session_id,
            )
            # _send() returns a dict on success and None on failure.
            if ok:
                sent += 1
            else:
                failed += 1
                logger.warning("Invite email not delivered for %s", matric)
        except Exception:
            logger.exception("Invite email failed for %s", matric)
            failed += 1
    return sent, failed


MAX_PROGRAMME_YEARS = 10   # generous ceiling for carry-over / spillover students


def _session_start_year(session_name: str) -> int | None:
    """'2024/2025' -> 2024."""
    m = re.match(r"\s*(\d{4})\s*/", session_name or "")
    return int(m.group(1)) if m else None


def _year_of_study(level: str) -> int | None:
    """'300L' -> 3, 'ND2' -> 2, 'HND1' -> 1. None when unrecognised."""
    if not level:
        return None
    lvl = level.strip().upper()
    m = re.match(r"^([1-9])00\s*L?$", lvl)          # 100L … 900L
    if m:
        return int(m.group(1))
    m = re.match(r"^(?:ND|HND|NCE|PGD)\s*([1-9])$", lvl)
    if m:
        return int(m.group(1))
    return None


def validate_matric_format(matric: str, session_name: str, level: str = "") -> str | None:
    """
    Check the matric shape, and that its entry year is possible for the level.

    The year inside a matric number is the student's ENTRY year and never
    changes, so a register is expected to contain several different years at
    once — a 300L student in 2024/2025 entered in 2022. What is *not* possible
    is an entry year that would make the student too junior for the level they
    are enrolled in (a 2025 entrant cannot be in 500L in 2025/2026), or one in
    the future. An entry year older than expected is allowed: that is exactly
    what a repeating or carry-over student looks like.
    """
    parts = matric.strip().upper().split('/')
    if len(parts) < 4:
        return "Matric number must follow the format with at least 4 parts (e.g., FPT/CSC/YY/NNNN)"

    if not re.fullmatch(r"\d{2}", parts[2]):
        return f"Matric number year segment must be 2 digits (e.g. FPT/CSC/24/0001), got '{parts[2]}'"

    session_start = _session_start_year(session_name)
    year_of_study = _year_of_study(level)
    # Unrecognised level or session name — validate shape only rather than
    # blocking an import on a format this function doesn't know about.
    if session_start is None or year_of_study is None:
        return None

    entry_year = 2000 + int(parts[2])
    expected_entry = session_start - (year_of_study - 1)

    if entry_year > session_start:
        return (
            f"Matric year '{parts[2]}' means admission in {entry_year}, which is after the "
            f"{session_name} session started. Check the matric number."
        )

    if entry_year > expected_entry:
        return (
            f"A {level} student in {session_name} would have entered in {expected_entry} "
            f"(matric '/{str(expected_entry)[-2:]}/'), but this matric says {entry_year}. "
            f"Check the level or the matric number."
        )

    if entry_year < expected_entry - MAX_PROGRAMME_YEARS:
        return (
            f"Matric year '{parts[2]}' ({entry_year}) is too far back for a {level} student "
            f"in {session_name}. Check the matric number."
        )

    return None


@router.post("/upload")
async def upload_register_csv(file: UploadFile = File(...), admin=Depends(get_current_admin)):
    """
    Upload and validate a CSV file. Returns a preview + validation errors.
    Does NOT import yet — use /confirm after reviewing.
    """
    with get_cursor() as cur:
        session = _get_active_session(cur)
    if not session:
        raise HTTPException(status_code=404, detail="No active session found")
    if not session[2]:
        raise HTTPException(status_code=403, detail="Register import portal is currently closed")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # Handle BOM
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    # Validate headers
    if not reader.fieldnames:
        raise HTTPException(status_code=400, detail="CSV file appears to be empty")

    headers = {h.strip().lower() for h in reader.fieldnames}
    missing = REQUIRED_COLUMNS - headers
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(sorted(missing))}"
        )

    # Normalize field name mapping
    field_map = {h.strip().lower(): h for h in reader.fieldnames}

    rows = []
    errors = []
    for i, raw_row in enumerate(reader, start=2):  # row 1 is header
        row = {k.strip().lower(): (v.strip() if v else "") for k, v in raw_row.items()}

        matric = row.get("matric_number", "").upper()
        gender = row.get("gender", "").lower()
        study_type = row.get("study_type", "").strip()

        if not matric:
            errors.append(f"Row {i}: matric_number is blank")
            continue
        if gender not in VALID_GENDERS:
            errors.append(f"Row {i}: invalid gender '{gender}' (must be male/female)")
            continue
        if study_type not in VALID_STUDY_TYPES:
            errors.append(f"Row {i}: invalid study_type '{study_type}' (must be Full-time/Part-time/CODFEL)")
            continue

        email = row.get("email", "").strip().lower()
        if not email:
            errors.append(f"Row {i}: email is blank — required for system notifications")
            continue

        matric_err = validate_matric_format(matric, session[1], row.get("level", ""))
        if matric_err:
            errors.append(f"Row {i}: {matric_err}")
            continue

        rows.append({
            "matric_number": matric,
            "surname": row.get("surname", "").title(),
            "first_name": row.get("first_name", "").title(),
            "gender": gender,
            "department": row.get("department", ""),
            "level": row.get("level", ""),
            "study_type": study_type,
            "faculty": row.get("faculty", ""),
            "email": email,
            "row_index": i,
        })

    # Bulk duplicate check
    if rows:
        matrics_in_csv = [r["matric_number"] for r in rows]
        with get_cursor() as cur:
            cur.execute(
                "SELECT matric_number FROM session_register WHERE matric_number = ANY(%s)",
                (matrics_in_csv,)
            )
            existing_matrics = {row[0] for row in cur.fetchall()}
            
        if existing_matrics:
            # Keep rows that don't exist, and add errors for those that do
            valid_rows = []
            for r in rows:
                if r["matric_number"] in existing_matrics:
                    errors.append(f"Row {r['row_index']}: Matric number {r['matric_number']} already exists in the system and cannot be registered again.")
                else:
                    valid_rows.append(r)
            rows = valid_rows

    return {
        "session_id": session[0],
        "session_name": session[1],
        "total_rows": len(rows),
        "error_count": len(errors),
        "errors": errors[:20],  # Cap errors shown
        "preview": rows[:10],
        "all_rows": rows,  # Full data for confirm step
    }


@router.post("/confirm")
def confirm_register_import(body: dict, admin=Depends(get_current_admin)):
    """
    Confirm and import the validated CSV rows into session_register.
    Expects: {"session_id": int, "rows": [...], "send_invite": bool (default true)}
    Sends an invitation email to each newly inserted student.
    """
    session_id = body.get("session_id")
    rows = body.get("rows", [])
    send_invite = body.get("send_invite", True)  # default: always send

    if not session_id or not rows:
        raise HTTPException(status_code=400, detail="session_id and rows are required")

    with get_cursor() as cur:
        session = _get_active_session(cur)
    if not session or session[0] != session_id:
        raise HTTPException(status_code=400, detail="Session mismatch or no active session")

    session_name = session[1]
    imported = 0
    skipped = 0
    row_errors = []

    with get_connection() as conn:
        with conn.cursor() as cur:
            for row in rows:
                # Each row gets its own savepoint. Without one, a single failing
                # row aborts the whole transaction and every subsequent row dies
                # with InFailedSqlTransaction — silently counted as "skipped".
                try:
                    cur.execute("SAVEPOINT import_row")
                    cur.execute(
                        """INSERT INTO session_register
                           (session_id, matric_number, surname, first_name, gender,
                            department, level, study_type, faculty, email)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                           ON CONFLICT (session_id, matric_number) DO UPDATE SET
                               surname = EXCLUDED.surname,
                               first_name = EXCLUDED.first_name,
                               gender = EXCLUDED.gender,
                               department = EXCLUDED.department,
                               level = EXCLUDED.level,
                               study_type = EXCLUDED.study_type,
                               faculty = EXCLUDED.faculty,
                               email = EXCLUDED.email
                        """,
                        (
                            session_id,
                            row["matric_number"],
                            row["surname"],
                            row["first_name"],
                            row["gender"],
                            row.get("department", ""),
                            row.get("level", ""),
                            row.get("study_type", "Full-time"),
                            row.get("faculty", ""),
                            row.get("email", ""),
                        ),
                    )
                    cur.execute("RELEASE SAVEPOINT import_row")
                    imported += 1
                except Exception as e:
                    cur.execute("ROLLBACK TO SAVEPOINT import_row")
                    skipped += 1
                    if len(row_errors) < 20:
                        row_errors.append(
                            f"{row.get('matric_number', '?')}: {str(e).splitlines()[0]}"
                        )

            conn.commit()

    # Who still needs an invite is derived from what was actually sent, not from
    # whether this particular INSERT was new — so a re-upload, a half-finished
    # send, or a restarted worker all resolve correctly instead of silently
    # skipping people.
    pending = []
    if send_invite:
        with get_cursor() as cur:
            pending = _students_missing_invite(cur, session_id)

    log_event(
        REGISTER_IMPORTED, "admin", admin["identifier"],
        f"Imported {imported} student records for session {session_name}",
        target_entity="session_register",
        metadata={"imported": imported, "skipped": skipped,
                  "invites_queued": len(pending), "row_errors": row_errors[:5]},
        session_id=session_id,
    )

    sent = failed = 0
    if pending:
        sent, failed = _send_invites(pending, session_name, session_id)

    msg = f"Imported {imported} student records."
    if skipped:
        msg += f" {skipped} skipped."
    if sent:
        msg += f" {sent} invitation email(s) sent."
    if failed:
        msg += f" {failed} invitation(s) failed — use 'Send pending invites' to retry."

    return {
        "message": msg,
        "imported": imported,
        "skipped": skipped,
        "row_errors": row_errors,
        "invites_sent": sent,
        "invites_failed": failed,
    }


@router.get("/pending-invites")
def pending_invites(admin=Depends(get_current_admin)):
    """
    Invite status for the active session.

    `no_email` is reported separately from `pending`: those students cannot be
    invited at all until an address is supplied, so counting them as merely
    pending would report zero outstanding work while they sit unreachable.
    """
    with get_cursor() as cur:
        session = _get_active_session(cur)
        if not session:
            return {"pending": 0, "no_email": 0, "session_name": None}
        missing = _students_missing_invite(cur, session[0])
        cur.execute(
            """SELECT COUNT(*) FROM session_register
               WHERE session_id = %s AND COALESCE(email, '') = ''""",
            (session[0],),
        )
        no_email = cur.fetchone()[0]
    return {"pending": len(missing), "no_email": no_email, "session_name": session[1]}


@router.post("/send-pending-invites")
def send_pending_invites(admin=Depends(get_current_admin)):
    """Retry invitations for anyone in the register who never received one."""
    with get_cursor() as cur:
        session = _get_active_session(cur)
        if not session:
            raise HTTPException(status_code=400, detail="No active session")
        missing = _students_missing_invite(cur, session[0])

    if not missing:
        return {"message": "Every student in the register already has an invitation.",
                "invites_sent": 0, "invites_failed": 0}

    sent, failed = _send_invites(missing, session[1], session[0])
    msg = f"{sent} invitation email(s) sent."
    if failed:
        msg += f" {failed} still failing — check the email logs."
    return {"message": msg, "invites_sent": sent, "invites_failed": failed}


@router.get("/stats")
def register_stats(admin=Depends(get_current_admin)):
    """Return count of imported records for the active session."""
    with get_cursor() as cur:
        session = _get_active_session(cur)
        if not session:
            return {"count": 0, "session_name": None}

        cur.execute(
            "SELECT COUNT(*) FROM session_register WHERE session_id = %s",
            (session[0],),
        )
        count = cur.fetchone()[0]

    return {"count": count, "session_id": session[0], "session_name": session[1]}


@router.post("/add-student")
def add_single_student(body: dict, admin=Depends(get_current_admin)):
    """Manually add a single student to the session register and send them an invite email."""
    with get_cursor() as cur:
        session = _get_active_session(cur)
    if not session:
        raise HTTPException(status_code=404, detail="No active session found")
    if not session[2]:
        raise HTTPException(status_code=403, detail="Register import portal is currently closed")

    matric = (body.get("matric_number") or "").strip().upper()
    surname = (body.get("surname") or "").strip().title()
    first_name = (body.get("first_name") or "").strip().title()
    gender = (body.get("gender") or "").strip().lower()
    department = (body.get("department") or "").strip()
    level = (body.get("level") or "").strip()
    study_type = (body.get("study_type") or "").strip()
    faculty = (body.get("faculty") or "").strip()
    email = (body.get("email") or "").strip().lower()
    send_invite = body.get("send_invite", True)

    if not matric:
        raise HTTPException(status_code=400, detail="Matric number is required")
    if not surname or not first_name:
        raise HTTPException(status_code=400, detail="Surname and first name are required")
    if gender not in VALID_GENDERS:
        raise HTTPException(status_code=400, detail=f"Gender must be male or female, got '{gender}'")
    if study_type not in VALID_STUDY_TYPES:
        raise HTTPException(status_code=400, detail=f"Study type must be Full-time, Part-time, or Sandwich")
    if not email:
        raise HTTPException(status_code=400, detail="Email is required — it will receive system notifications")

    matric_err = validate_matric_format(matric, session[1], level)
    if matric_err:
        raise HTTPException(status_code=400, detail=matric_err)

    with get_cursor() as cur:
        cur.execute("SELECT 1 FROM session_register WHERE matric_number = %s LIMIT 1", (matric,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail=f"Matric number {matric} already exists in the system and cannot be registered again.")

    is_new_insert = False
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO session_register
                   (session_id, matric_number, surname, first_name, gender,
                    department, level, study_type, faculty, email)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (session_id, matric_number) DO UPDATE SET
                       surname = EXCLUDED.surname,
                       first_name = EXCLUDED.first_name,
                       gender = EXCLUDED.gender,
                       department = EXCLUDED.department,
                       level = EXCLUDED.level,
                       study_type = EXCLUDED.study_type,
                       faculty = EXCLUDED.faculty,
                       email = EXCLUDED.email
                   RETURNING xmax
                """,
                (session[0], matric, surname, first_name, gender,
                 department, level, study_type, faculty, email),
            )
            result = cur.fetchone()
            is_new_insert = result and str(result[0]) == '0'
            conn.commit()

    log_event(
        REGISTER_IMPORTED, "admin", admin["identifier"],
        f"Manually added student {matric} to session {session[1]}",
        target_entity="session_register",
        metadata={"matric_number": matric, "method": "manual", "is_new": is_new_insert},
        session_id=session[0],
    )

    # Sent inline rather than on a daemon thread, which dies with the worker —
    # and so the response can state whether it actually went out.
    invite_sent = False
    if is_new_insert and send_invite and email:
        sent, _ = _send_invites([(matric, first_name, email)], session[1], session[0])
        invite_sent = sent == 1

    msg = f"Student {matric} added to session register successfully."
    if is_new_insert and send_invite:
        msg += " Invitation email sent." if invite_sent else " Invitation email could not be sent — retry from 'Send pending invites'."

    return {
        "message": msg,
        "invite_sent": invite_sent,
    }


@router.get("/template")
def download_csv_template():
    """Return a CSV template with required headers and sample rows."""
    from fastapi.responses import Response

    # Sample matric numbers carry the active session's entry year rather than a
    # fixed one, so the template matches whichever session is being imported.
    yy = "25"
    try:
        with get_cursor() as cur:
            session = _get_active_session(cur)
        if session and session[1] and "/" in session[1]:
            yy = session[1].split("/")[0][-2:]
    except Exception:
        pass

    header = "matric_number,surname,first_name,gender,department,level,study_type,faculty,email\n"
    sample1 = f"FPT/CSC/{yy}/0001,Doe,John,male,Computer Science,100L,Full-time,Science,john.doe@student.edu.ng\n"
    sample2 = f"FPT/CSC/{yy}/0002,Smith,Jane,female,Mathematics,200L,Part-time,Science,jane.smith@student.edu.ng\n"

    return Response(
        content=header + sample1 + sample2,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=session_register_template.csv"},
    )
