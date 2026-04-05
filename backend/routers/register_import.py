"""
Register Import Router — CSV upload of enrolled students per session.

Admin uploads a CSV with columns: matric_number, surname, first_name, gender,
department, level, study_type, faculty (optional).
The system validates, previews, and imports into session_register.
"""
import csv
import io

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from database import get_cursor, get_connection
from dependencies import get_current_admin
from services.audit_logger import log_event, REGISTER_IMPORTED

router = APIRouter(prefix="/api/v1/admin/register", tags=["register_import"])

REQUIRED_COLUMNS = {"matric_number", "surname", "first_name", "gender", "department", "level", "study_type"}
VALID_GENDERS = {"male", "female"}
VALID_STUDY_TYPES = {"Full-time", "Part-time", "Sandwich"}


def _get_active_session(cur):
    cur.execute("SELECT id, session_name, register_import_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
    return cur.fetchone()


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
            errors.append(f"Row {i}: invalid study_type '{study_type}' (must be Full-time/Part-time/Sandwich)")
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
        })

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
    Expects: {"session_id": int, "rows": [...]}
    """
    session_id = body.get("session_id")
    rows = body.get("rows", [])

    if not session_id or not rows:
        raise HTTPException(status_code=400, detail="session_id and rows are required")

    with get_cursor() as cur:
        session = _get_active_session(cur)
    if not session or session[0] != session_id:
        raise HTTPException(status_code=400, detail="Session mismatch or no active session")

    imported = 0
    skipped = 0

    with get_connection() as conn:
        with conn.cursor() as cur:
            for row in rows:
                try:
                    cur.execute(
                        """INSERT INTO session_register
                           (session_id, matric_number, surname, first_name, gender,
                            department, level, study_type, faculty)
                           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                           ON CONFLICT (session_id, matric_number) DO UPDATE SET
                               surname = EXCLUDED.surname,
                               first_name = EXCLUDED.first_name,
                               gender = EXCLUDED.gender,
                               department = EXCLUDED.department,
                               level = EXCLUDED.level,
                               study_type = EXCLUDED.study_type,
                               faculty = EXCLUDED.faculty
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
                        ),
                    )
                    imported += 1
                except Exception:
                    skipped += 1

            conn.commit()

    log_event(
        REGISTER_IMPORTED, "admin", admin["identifier"],
        f"Imported {imported} student records for session {session[1]}",
        target_entity="session_register",
        metadata={"imported": imported, "skipped": skipped},
        session_id=session_id,
    )

    return {
        "message": f"Successfully imported {imported} student records. {skipped} skipped.",
        "imported": imported,
        "skipped": skipped,
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
    """Manually add a single student to the session register."""
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

    if not matric:
        raise HTTPException(status_code=400, detail="Matric number is required")
    if not surname or not first_name:
        raise HTTPException(status_code=400, detail="Surname and first name are required")
    if gender not in VALID_GENDERS:
        raise HTTPException(status_code=400, detail=f"Gender must be male or female, got '{gender}'")
    if study_type not in VALID_STUDY_TYPES:
        raise HTTPException(status_code=400, detail=f"Study type must be Full-time, Part-time, or Sandwich")

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO session_register
                   (session_id, matric_number, surname, first_name, gender,
                    department, level, study_type, faculty)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (session_id, matric_number) DO UPDATE SET
                       surname = EXCLUDED.surname,
                       first_name = EXCLUDED.first_name,
                       gender = EXCLUDED.gender,
                       department = EXCLUDED.department,
                       level = EXCLUDED.level,
                       study_type = EXCLUDED.study_type,
                       faculty = EXCLUDED.faculty
                """,
                (session[0], matric, surname, first_name, gender,
                 department, level, study_type, faculty),
            )
            conn.commit()

    log_event(
        REGISTER_IMPORTED, "admin", admin["identifier"],
        f"Manually added student {matric} to session {session[1]}",
        target_entity="session_register",
        metadata={"matric_number": matric, "method": "manual"},
        session_id=session[0],
    )

    return {"message": f"Student {matric} added to session register successfully."}


@router.get("/template")
def download_csv_template():
    """Return a CSV template with required headers and sample rows."""
    from fastapi.responses import Response

    header = "matric_number,surname,first_name,gender,department,level,study_type,faculty\n"
    sample1 = "FPT/CSC/25/0001,Doe,John,male,Computer Science,100L,Full-time,Science\n"
    sample2 = "FPT/CSC/25/0002,Smith,Jane,female,Mathematics,200L,Part-time,Science\n"

    return Response(
        content=header + sample1 + sample2,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=session_register_template.csv"},
    )
