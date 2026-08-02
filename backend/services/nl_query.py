"""
Natural-language → SQL for the admin dashboard.

An LLM writes SQL that then runs against the production database, so the
generated statement is treated as hostile input at every stage:

  1. Structural validation — exactly one statement, and it must be a SELECT.
  2. Keyword denylist      — no DDL/DML/permission verbs anywhere in the text.
  3. READ ONLY transaction — the real guarantee. Even if 1 and 2 were bypassed,
                             Postgres itself refuses to write in this mode.
  4. Row + time limits     — a runaway query can't exhaust the connection pool.
"""
import logging
import re

import httpx

from config import GROQ_API_KEY, OPENROUTER_API_KEY
from database import get_connection

logger = logging.getLogger(__name__)

# Both expose an OpenAI-compatible chat/completions endpoint, so one request
# shape covers either. Tried in order; the first with a configured key wins,
# and a transport/auth failure falls through to the next.
PROVIDERS = [
    ("groq", "https://api.groq.com/openai/v1/chat/completions",
     "llama-3.3-70b-versatile", lambda: GROQ_API_KEY),
    ("openrouter", "https://openrouter.ai/api/v1/chat/completions",
     "google/gemini-2.0-flash-001", lambda: OPENROUTER_API_KEY),
]

MAX_ROWS = 200
STATEMENT_TIMEOUT_MS = 8000

# Compact schema so the model doesn't have to guess column names.
SCHEMA = """
users(id, identifier, surname, first_name, email, phone, gender, department,
      level, study_type, role, next_of_kin_name, next_of_kin_phone, is_active,
      created_at, passport_photo_url)
      -- identifier is the matric number. role: 'student' | 'admin'.
academic_sessions(id, session_name, year_start, year_end, eligible_levels,
      is_active, application_portal_open, payment_portal_open,
      allocation_portal_open, register_import_open, eligibility_portal_open,
      application_fee_deadline, hostel_fee_deadline, session_ended, created_at)
session_register(id, session_id, matric_number, surname, first_name, gender,
      department, level, study_type, faculty, email, created_at)
hostels(id, name, gender_restriction, capacity, status)
blocks(id, hostel_id, name, status)
rooms(id, block_id, room_number, status, disability_reserved)
beds(id, room_id, bed_number, status)   -- status: 'vacant' | 'occupied' | 'maintenance'
hostel_applications(id, student_id, session_id, choice_1_id, choice_2_id,
      choice_3_id, status, has_special_needs, special_needs_type,
      medical_doc_path, medical_reviewed_by, medical_reviewed_at,
      stage_completed, submitted_at)
      -- choice_N_id reference hostels.id
confirmed_payments(id, student_id, session_id, hms_reference, paystack_id,
      total_amount_kobo, fee_type, payment_channel, paystack_status, status, confirmed_at)
      -- status: 'pending' | 'confirmed'
      -- fee_type: 'application' | 'hostel' — a student pays BOTH in one session,
      --   so there are up to two rows per (student_id, session_id). Filter on
      --   fee_type, or COUNT(DISTINCT student_id), when counting students.
pending_payments(id, student_id, session_id, paystack_reference, amount_kobo,
      status, created_at, completed_at)
payment_component_log(id, payment_id, component_id, component_name, amount_kobo)
fee_components(id, session_id, name, amount_fulltime, amount_parttime,
      amount_sandwich, amount_codfel, applies_to, is_mandatory, fee_type, sort_order)
allocations(id, student_id, bed_id, session_id, payment_id,
      matched_from_preference, avg_compatibility_score, status,
      revocation_reason, revoked_by, revoked_at, allocated_at, payment_status,
      payment_deadline, checked_in, checked_in_at, checked_in_by)
      -- status: 'active' | 'expired' | 'revoked'
student_vectors(id, student_id, session_id, v1, v2, v3, v4, v5, v6, v7, v8, submitted_at)
compatibility_scores(id, student_a_id, student_b_id, session_id, score, computed_at)
eligibility_status(id, student_id, session_id, is_eligible, eligible_at,
      student_level, required_docs_submitted, required_docs_total)
eligibility_documents(id, student_id, session_id, document_type, file_path,
      ai_verdict, rejection_reason, uploaded_at, verified_at)
checkouts(id, student_id, session_id, bed_id, hostel_name, block_name,
      room_number, bed_number, checkout_type, reason, checked_out_at)
audit_logs(id, timestamp, actor_type, actor_id, action_type, target_entity,
      target_id, description, metadata, session_id)
email_logs(id, recipient_email, recipient_name, recipient_matric, subject,
      email_type, status, sent_at, session_id)
"""

PROMPT = f"""You translate questions about a university hostel management database into a single PostgreSQL SELECT query.

Schema:
{SCHEMA}

Rules:
- Return ONLY the SQL. No markdown fences, no explanation, no trailing semicolon.
- Exactly one SELECT statement. Never INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT or COPY.
- Prefer human-readable columns (names over raw ids) and alias them clearly.
- Every id column is an integer. users.identifier (the matric number) is text — never compare it to an integer.
- "this session" / "current session" means the row in academic_sessions where is_active = TRUE.
  When selecting it inside a scalar subquery always append LIMIT 1, e.g.
  (SELECT id FROM academic_sessions WHERE is_active = TRUE LIMIT 1).
- Students are rows in users where role = 'student'.
- A student is "allocated" when they have an allocations row with status = 'active'.
- A payment counts as made when confirmed_payments.status = 'confirmed'; the amount column is total_amount_kobo.
- Amounts are stored in kobo; divide by 100.0 to report naira.
- To reach a hostel from an allocation: allocations -> beds -> rooms -> blocks -> hostels.
- Always constrain result size with LIMIT {MAX_ROWS} unless the query is a single aggregate.
"""

# Anywhere in the statement — not just at the start.
FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|"
    r"vacuum|reindex|cluster|listen|notify|call|do|execute|prepare|set|reset)\b",
    re.IGNORECASE,
)


class NLQueryError(Exception):
    """Raised for anything the admin should see as a plain message."""


def _strip_fences(text: str) -> str:
    """Models wrap SQL in ```sql fences despite being told not to."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:sql)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip().rstrip(";").strip()


def _validate(sql: str) -> None:
    if not sql:
        raise NLQueryError("The model did not return a query. Try rephrasing.")

    # One statement only — a trailing ';' is already stripped, so any remaining
    # semicolon means a second statement was appended.
    if ";" in sql:
        raise NLQueryError("Only a single statement is allowed.")

    if not re.match(r"^\s*(select|with)\b", sql, re.IGNORECASE):
        raise NLQueryError("Only SELECT queries are allowed.")

    if FORBIDDEN.search(sql):
        raise NLQueryError("The generated query contained a disallowed operation and was blocked.")


def _generate_sql(question: str) -> str:
    configured = [p for p in PROVIDERS if p[3]()]
    if not configured:
        raise NLQueryError(
            "AI query is not configured on this server — set GROQ_API_KEY or OPENROUTER_API_KEY."
        )

    for name, url, model, get_key in configured:
        try:
            res = httpx.post(
                url,
                headers={
                    "Authorization": f"Bearer {get_key()}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "temperature": 0,
                    "messages": [
                        {"role": "system", "content": PROMPT},
                        {"role": "user", "content": question},
                    ],
                },
                timeout=30.0,
            )
        except httpx.RequestError as e:
            logger.warning("%s unreachable: %s", name, e)
            continue

        if res.status_code != 200:
            logger.warning("%s returned %s: %s", name, res.status_code, res.text[:300])
            continue

        try:
            return _strip_fences(res.json()["choices"][0]["message"]["content"])
        except (KeyError, IndexError, TypeError):
            logger.warning("%s sent an unreadable payload: %s", name, res.text[:300])
            continue

    raise NLQueryError("Could not reach the AI service. Try again shortly.")


def run_nl_query(question: str) -> dict:
    """Translate `question` to SQL, run it read-only, return {sql, columns, rows}."""
    sql = _generate_sql(question)
    _validate(sql)

    with get_connection() as conn:
        with conn.cursor() as cur:
            # The actual enforcement: Postgres refuses writes for this
            # transaction regardless of what the generated SQL asks for.
            cur.execute("SET TRANSACTION READ ONLY")
            cur.execute(f"SET LOCAL statement_timeout = {STATEMENT_TIMEOUT_MS}")
            try:
                cur.execute(sql)
            except Exception as e:
                logger.info("NL query failed (%s): %s", type(e).__name__, sql)
                raise NLQueryError(f"That query could not be run: {str(e).splitlines()[0]}")

            columns = [d[0] for d in cur.description] if cur.description else []
            rows = [
                [str(v) if v is not None else None for v in row]
                for row in cur.fetchmany(MAX_ROWS)
            ]

    return {"sql": sql, "columns": columns, "rows": rows}
