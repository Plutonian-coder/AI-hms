"""
Register Import Router — CSV upload of enrolled students per session.

Admin uploads a CSV with columns: matric_number, surname, first_name, gender,
department, level, study_type, faculty (optional).
The system validates, previews, and imports into session_register.
"""
import csv
import io
import threading

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from database import get_cursor, get_connection
from dependencies import get_current_admin
from services.audit_logger import log_event, REGISTER_IMPORTED
from services.email import send_student_invite_email

router = APIRouter(prefix="/api/v1/admin/register", tags=["register_import"])

REQUIRED_COLUMNS = {"matric_number", "surname", "first_name", "gender", "department", "level", "study_type", "email"}
VALID_GENDERS = {"male", "female"}
VALID_STUDY_TYPES = {"Full-time", "Part-time", "CODFEL"}


def _get_active_session(cur):
    cur.execute("SELECT id, session_name, register_import_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
    return cur.fetchone()


def validate_matric_format(matric: str, session_name: str) -> str | None:
    """
    Validates that a matric number follows the basic FUOYE format (e.g., FPT/CSC/26/0009).
    We do NOT restrict the session year, as returning/carry-over students 
    will have matric numbers from previous sessions.
    """
    parts = matric.strip().upper().split('/')
    if len(parts) < 4:
        return f"Matric number must follow the format with at least 4 parts (e.g., FPT/CSC/YY/NNNN)"
    
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

        matric_err = validate_matric_format(matric, session[1])
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
    new_students = []  # collect genuinely new inserts for invite emails

    with get_connection() as conn:
        with conn.cursor() as cur:
            for row in rows:
                try:
                    # RETURNING xmax: xmax = 0 means this was a fresh INSERT (not an upsert-update).
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
                    result = cur.fetchone()
                    is_new_insert = result and str(result[0]) == '0'
                    if is_new_insert and send_invite and row.get("email"):
                        new_students.append(row)
                    imported += 1
                except Exception:
                    skipped += 1

            conn.commit()

    log_event(
        REGISTER_IMPORTED, "admin", admin["identifier"],
        f"Imported {imported} student records for session {session_name}",
        target_entity="session_register",
        metadata={"imported": imported, "skipped": skipped, "invites_queued": len(new_students)},
        session_id=session_id,
    )

    # Fire invite emails in background so the HTTP response is immediate
    if new_students:
        def _send_invites():
            for s in new_students:
                try:
                    send_student_invite_email(
                        to_email=s["email"],
                        first_name=s["first_name"],
                        matric_number=s["matric_number"],
                        session_name=session_name,
                        session_id=session_id,
                    )
                except Exception:
                    pass  # _send() already logs internally; never crash the thread

        threading.Thread(target=_send_invites, daemon=True).start()

    return {
        "message": f"Successfully imported {imported} student records. {skipped} skipped.",
        "imported": imported,
        "skipped": skipped,
        "invites_sent": len(new_students),
    }


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

    matric_err = validate_matric_format(matric, session[1])
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

    # Send invite email if this is a new student (not a re-import update)
    if is_new_insert and send_invite:
        threading.Thread(
            target=send_student_invite_email,
            kwargs={
                "to_email": email,
                "first_name": first_name,
                "matric_number": matric,
                "session_name": session[1],
                "session_id": session[0],
            },
            daemon=True,
        ).start()

    return {
        "message": f"Student {matric} added to session register successfully.",
        "invite_sent": bool(is_new_insert and send_invite),
    }


@router.get("/template")
def download_csv_template():
    """Return a CSV template with required headers and sample rows."""
    from fastapi.responses import Response

    header = "matric_number,surname,first_name,gender,department,level,study_type,faculty,email\n"
    sample1 = "FPT/CSC/25/0001,Doe,John,male,Computer Science,100L,Full-time,Science,john.doe@student.edu.ng\n"
    sample2 = "FPT/CSC/25/0002,Smith,Jane,female,Mathematics,200L,Part-time,Science,jane.smith@student.edu.ng\n"

    return Response(
        content=header + sample1 + sample2,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=session_register_template.csv"},
    )
