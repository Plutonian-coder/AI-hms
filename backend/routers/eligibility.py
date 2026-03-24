"""
Eligibility Router — Document-based eligibility verification with AI (Gemini) analysis.

Freshmen (ND1/HND1): Must upload Acceptance Fee receipt.
Returning (ND2/HND2): Must upload School Fees receipt.

Each document is verified via Gemini Vision, which checks authenticity,
extracts the student's identifier and RRR for identity matching and
payment validation against the Remita database.
"""
import os
import uuid
import json
import hashlib
from fastapi import APIRouter, UploadFile, File, Form, Depends
from fastapi.responses import StreamingResponse
from database import get_cursor, get_connection
from services.eligibility_ocr import verify_eligibility_document
from dependencies import get_current_student
from config import UPLOAD_DIR

router = APIRouter(prefix="/api/v1/eligibility", tags=["eligibility"])

os.makedirs(UPLOAD_DIR, exist_ok=True)

TOTAL_STEPS = 6

# Which documents each level requires (1 per level)
LEVEL_REQUIREMENTS = {
    "ND1":  ["acceptance_fee"],
    "HND1": ["acceptance_fee"],
    "ND2":  ["school_fees"],
    "HND2": ["school_fees"],
}

DOC_LABELS = {
    "acceptance_fee": "Acceptance Fee Receipt",
    "e_screening": "E-Screening Receipt",
    "school_fees": "School Fees Receipt",
}


# ---- SSE Helpers ----

def _sse_step(step: int, status: str, title: str, detail: str) -> str:
    payload = json.dumps({"step": step, "total": TOTAL_STEPS, "status": status, "title": title, "detail": detail})
    return f"event: step\ndata: {payload}\n\n"


def _sse_error(step: int, title: str, detail: str) -> str:
    payload = json.dumps({"step": step, "total": TOTAL_STEPS, "title": title, "detail": detail})
    return f"event: error\ndata: {payload}\n\n"


def _sse_result(data: dict) -> str:
    return f"event: result\ndata: {json.dumps(data)}\n\n"


# ---- Endpoints ----

@router.get("/requirements")
def get_requirements(student=Depends(get_current_student)):
    """Return which documents the student needs based on their level."""
    student_id = student["user_id"]

    with get_cursor() as cur:
        cur.execute("SELECT level FROM users WHERE id = %s", (student_id,))
        row = cur.fetchone()

    level = row[0] if row and row[0] else None

    if not level or level not in LEVEL_REQUIREMENTS:
        return {
            "level": level,
            "level_set": False,
            "required_docs": [],
            "doc_labels": DOC_LABELS,
        }

    required = LEVEL_REQUIREMENTS[level]
    return {
        "level": level,
        "level_set": True,
        "required_docs": required,
        "doc_labels": {k: v for k, v in DOC_LABELS.items() if k in required},
    }


@router.get("/status")
def get_eligibility_status(student=Depends(get_current_student)):
    """Return the student's current eligibility status for the active session."""
    student_id = student["user_id"]

    # Get active session
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, session_name, eligibility_portal_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1"
        )
        sess = cur.fetchone()

    if not sess:
        return {"session": None, "is_eligible": False, "documents": [], "portal_open": False}

    session_id, session_name, portal_open = sess

    # Get student level
    with get_cursor() as cur:
        cur.execute("SELECT level FROM users WHERE id = %s", (student_id,))
        level_row = cur.fetchone()

    level = level_row[0] if level_row and level_row[0] else None
    required_docs = LEVEL_REQUIREMENTS.get(level, []) if level else []

    # Get eligibility status
    with get_cursor() as cur:
        cur.execute(
            "SELECT is_eligible, eligible_at, required_docs_submitted, required_docs_total FROM eligibility_status WHERE student_id = %s AND session_id = %s",
            (student_id, session_id),
        )
        elig_row = cur.fetchone()

    # Get uploaded documents
    with get_cursor() as cur:
        cur.execute(
            "SELECT document_type, ai_verdict, rejection_reason, uploaded_at, verified_at FROM eligibility_documents WHERE student_id = %s AND session_id = %s",
            (student_id, session_id),
        )
        doc_rows = cur.fetchall()

    documents = [
        {
            "document_type": r[0],
            "label": DOC_LABELS.get(r[0], r[0]),
            "ai_verdict": r[1],
            "rejection_reason": r[2],
            "uploaded_at": r[3].isoformat() if r[3] else None,
            "verified_at": r[4].isoformat() if r[4] else None,
        }
        for r in doc_rows
    ]

    return {
        "session": {"id": session_id, "name": session_name},
        "portal_open": portal_open,
        "level": level,
        "level_set": bool(level and level in LEVEL_REQUIREMENTS),
        "required_docs": required_docs,
        "is_eligible": elig_row[0] if elig_row else False,
        "eligible_at": elig_row[1].isoformat() if elig_row and elig_row[1] else None,
        "docs_submitted": elig_row[2] if elig_row else 0,
        "docs_required": elig_row[3] if elig_row else len(required_docs),
        "documents": documents,
    }


@router.post("/upload")
async def upload_eligibility_document(
    document_type: str = Form(...),
    document: UploadFile = File(...),
    student=Depends(get_current_student),
):
    """
    Upload and verify a single eligibility document via AI (SSE-streamed).
    6-step pipeline: Pre-flight → Upload → AI Verify → Identity Match → RRR Validation → Update Eligibility
    """
    file_content = await document.read()
    file_ext = os.path.splitext(document.filename or "doc.png")[1]

    def pipeline():
        student_id = student["user_id"]
        identifier = student["identifier"]

        # ── Step 1: Pre-flight Checks ──
        yield _sse_step(1, "processing", "Pre-flight Checks", "Verifying session and portal status...")

        # Validate document type
        if document_type not in DOC_LABELS:
            yield _sse_error(1, "Pre-flight Checks", f"Invalid document type: {document_type}")
            return

        # Check active session
        with get_cursor() as cur:
            cur.execute("SELECT id, eligibility_portal_open FROM academic_sessions WHERE is_active = TRUE LIMIT 1")
            session_row = cur.fetchone()

        if not session_row:
            yield _sse_error(1, "Pre-flight Checks", "No active academic session found. Contact admin.")
            return
        if not session_row[1]:
            yield _sse_error(1, "Pre-flight Checks", "The eligibility verification portal is currently closed.")
            return

        session_id = session_row[0]

        # Check student level
        with get_cursor() as cur:
            cur.execute("SELECT level, surname, first_name FROM users WHERE id = %s", (student_id,))
            level_row = cur.fetchone()

        level = level_row[0] if level_row and level_row[0] else None
        student_full_name = f"{level_row[1]} {level_row[2]}" if level_row else ""

        if not level or level not in LEVEL_REQUIREMENTS:
            yield _sse_error(1, "Pre-flight Checks", "Please set your level (ND1/ND2/HND1/HND2) in your profile first.")
            return

        # Check if this document type is required for student's level
        required = LEVEL_REQUIREMENTS[level]
        if document_type not in required:
            yield _sse_error(1, "Pre-flight Checks", f"'{DOC_LABELS[document_type]}' is not required for {level} students.")
            return

        # Check if already verified
        with get_cursor() as cur:
            cur.execute(
                "SELECT ai_verdict FROM eligibility_documents WHERE student_id = %s AND session_id = %s AND document_type = %s",
                (student_id, session_id, document_type),
            )
            existing = cur.fetchone()

        if existing and existing[0] == "verified":
            yield _sse_error(1, "Pre-flight Checks", f"Your {DOC_LABELS[document_type]} has already been verified.")
            return

        yield _sse_step(1, "complete", "Pre-flight Checks", "Portal open, document type valid")

        # ── Step 2: Upload Document ──
        yield _sse_step(2, "processing", "Uploading Document", "Saving your document...")

        filename = f"elig_{uuid.uuid4().hex}{file_ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(file_content)

        file_hash = hashlib.sha256(file_content).hexdigest()

        yield _sse_step(2, "complete", "Uploading Document", "Document saved securely")

        # ── Step 3: AI Document Verification ──
        yield _sse_step(3, "processing", "AI Document Verification", "Gemini AI is analyzing your document...")

        ocr_result = verify_eligibility_document(filepath, document_type)

        if not ocr_result["is_authentic"]:
            reason = ocr_result["rejection_reason"] or "Document does not appear to be authentic"
            _upsert_document(student_id, session_id, document_type, filepath, file_hash, None, None, None, "rejected", reason)
            yield _sse_error(3, "AI Document Verification", reason)
            return

        extracted_rrr = ocr_result.get("extracted_rrr")
        extracted_name = ocr_result.get("extracted_name")

        yield _sse_step(3, "complete", "AI Document Verification", "Document verified as authentic")

        # ── Step 4: Identity Match ──
        yield _sse_step(4, "processing", "Identity Verification", "Matching document to your student record...")

        extracted_id = ocr_result.get("extracted_identifier")

        if extracted_id:
            # Normalize for comparison
            normalized_extracted = extracted_id.strip().upper().replace(" ", "")
            normalized_student = identifier.strip().upper().replace(" ", "")

            if normalized_extracted != normalized_student:
                _upsert_document(
                    student_id, session_id, document_type, filepath, file_hash,
                    extracted_id, extracted_rrr, extracted_name, "rejected",
                    f"Document identifier ({extracted_id}) does not match your matric number ({identifier})"
                )
                yield _sse_error(4, "Identity Verification",
                                 f"The identifier on the document ({extracted_id}) does not match your student record ({identifier})")
                return
            yield _sse_step(4, "complete", "Identity Verification", f"Identity confirmed: {extracted_id}")
        else:
            # No identifier extracted — accept but log
            yield _sse_step(4, "complete", "Identity Verification", "Document accepted (identifier not extractable — manual review may apply)")

        # ── Step 5: RRR Validation ──
        yield _sse_step(5, "processing", "RRR Validation", "Checking Remita payment reference...")

        if extracted_rrr:
            with get_cursor() as cur:
                cur.execute(
                    "SELECT status, amount FROM mock_remita_payments WHERE rrr = %s",
                    (extracted_rrr,),
                )
                remita_row = cur.fetchone()

            if not remita_row:
                _upsert_document(
                    student_id, session_id, document_type, filepath, file_hash,
                    extracted_id, extracted_rrr, extracted_name, "rejected",
                    f"RRR {extracted_rrr} not found in the Remita payment database"
                )
                yield _sse_error(5, "RRR Validation",
                                 f"RRR {extracted_rrr} was not found in the payment database. Please upload a valid receipt.")
                return

            remita_status = remita_row[0]
            if remita_status not in ("paid", "used"):
                _upsert_document(
                    student_id, session_id, document_type, filepath, file_hash,
                    extracted_id, extracted_rrr, extracted_name, "rejected",
                    f"RRR {extracted_rrr} has status '{remita_status}' — payment not confirmed"
                )
                yield _sse_error(5, "RRR Validation",
                                 f"RRR {extracted_rrr} payment status is '{remita_status}'. Only paid receipts are accepted.")
                return

            yield _sse_step(5, "complete", "RRR Validation", f"RRR {extracted_rrr} confirmed — payment valid")
        else:
            # No RRR extracted — accept with warning
            yield _sse_step(5, "complete", "RRR Validation", "RRR not found on document — accepted (manual review may apply)")

        # ── Step 6: Update Eligibility ──
        yield _sse_step(6, "processing", "Updating Eligibility", "Recording verification result...")

        _upsert_document(student_id, session_id, document_type, filepath, file_hash, extracted_id, extracted_rrr, extracted_name, "verified", None)

        # Check if all required docs are now verified
        is_now_eligible = _update_eligibility_status(student_id, session_id, level)

        if is_now_eligible:
            yield _sse_step(6, "complete", "Updating Eligibility", "All documents verified — you are now ELIGIBLE!")
        else:
            remaining = _get_remaining_docs(student_id, session_id, level)
            remaining_labels = [DOC_LABELS.get(d, d) for d in remaining]
            yield _sse_step(6, "complete", "Updating Eligibility",
                            f"Document verified. Still needed: {', '.join(remaining_labels)}")

        yield _sse_result({"is_eligible": is_now_eligible, "document_type": document_type, "verdict": "verified"})

    return StreamingResponse(pipeline(), media_type="text/event-stream")


# ---- Helpers ----

def _upsert_document(student_id, session_id, document_type, file_path, file_hash, extracted_id, extracted_rrr, extracted_name, verdict, reason):
    """Insert or update an eligibility document record."""
    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO eligibility_documents (student_id, session_id, document_type, file_path, file_hash, extracted_identifier, extracted_rrr, extracted_name, ai_verdict, rejection_reason, verified_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CASE WHEN %s = 'verified' THEN CURRENT_TIMESTAMP ELSE NULL END)
            ON CONFLICT (student_id, session_id, document_type)
            DO UPDATE SET
                file_path = EXCLUDED.file_path,
                file_hash = EXCLUDED.file_hash,
                extracted_identifier = EXCLUDED.extracted_identifier,
                extracted_rrr = EXCLUDED.extracted_rrr,
                extracted_name = EXCLUDED.extracted_name,
                ai_verdict = EXCLUDED.ai_verdict,
                rejection_reason = EXCLUDED.rejection_reason,
                verified_at = CASE WHEN EXCLUDED.ai_verdict = 'verified' THEN CURRENT_TIMESTAMP ELSE NULL END,
                uploaded_at = CURRENT_TIMESTAMP
        """, (student_id, session_id, document_type, file_path, file_hash, extracted_id, extracted_rrr, extracted_name, verdict, reason, verdict))


def _update_eligibility_status(student_id, session_id, level):
    """Check if all required docs are verified, update eligibility_status. Returns True if now eligible."""
    required = LEVEL_REQUIREMENTS.get(level, [])
    required_total = len(required)

    with get_cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM eligibility_documents WHERE student_id = %s AND session_id = %s AND ai_verdict = 'verified'",
            (student_id, session_id),
        )
        verified_count = cur.fetchone()[0]

    is_eligible = verified_count >= required_total

    with get_cursor() as cur:
        cur.execute("""
            INSERT INTO eligibility_status (student_id, session_id, is_eligible, eligible_at, student_level, required_docs_submitted, required_docs_total)
            VALUES (%s, %s, %s, CASE WHEN %s THEN CURRENT_TIMESTAMP ELSE NULL END, %s, %s, %s)
            ON CONFLICT (student_id, session_id)
            DO UPDATE SET
                is_eligible = EXCLUDED.is_eligible,
                eligible_at = CASE WHEN EXCLUDED.is_eligible AND NOT eligibility_status.is_eligible THEN CURRENT_TIMESTAMP ELSE eligibility_status.eligible_at END,
                required_docs_submitted = EXCLUDED.required_docs_submitted,
                required_docs_total = EXCLUDED.required_docs_total
        """, (student_id, session_id, is_eligible, is_eligible, level, verified_count, required_total))

    return is_eligible


def _get_remaining_docs(student_id, session_id, level):
    """Return list of document types still needed."""
    required = LEVEL_REQUIREMENTS.get(level, [])

    with get_cursor() as cur:
        cur.execute(
            "SELECT document_type FROM eligibility_documents WHERE student_id = %s AND session_id = %s AND ai_verdict = 'verified'",
            (student_id, session_id),
        )
        verified = {r[0] for r in cur.fetchall()}

    return [d for d in required if d not in verified]
