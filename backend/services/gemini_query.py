"""
Natural Language Query Service — Converts plain English admin queries
to read-only SQL via OpenRouter (Gemini 2.5 Flash), validates for safety,
and executes against the live database.
"""
import re
from openai import OpenAI

from config import OPENROUTER_API_KEY

# OpenRouter uses the OpenAI-compatible API
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

MODEL = "google/gemini-3.1-flash-lite-preview"

# The schema context sent to the LLM
DB_SCHEMA = """
Tables:
- users (id, identifier, surname, first_name, email, phone, gender, department, level, study_type, role, next_of_kin_name, next_of_kin_phone, is_active, created_at)
- academic_sessions (id, session_name, year_start, year_end, eligible_levels, is_active, application_portal_open, payment_portal_open, allocation_portal_open, register_import_open, session_ended, created_at)
- session_register (id, session_id, matric_number, surname, first_name, gender, department, level, study_type, faculty, created_at) — FK session_id → academic_sessions
- hostels (id, name, gender_restriction, capacity, status)
- blocks (id, hostel_id, name, status) — FK hostel_id → hostels
- rooms (id, block_id, room_number, status) — FK block_id → blocks
- beds (id, room_id, bed_number, status) — FK room_id → rooms. Status: vacant/occupied/maintenance
- fee_components (id, session_id, name, amount_fulltime, amount_parttime, amount_sandwich, applies_to, is_mandatory, sort_order) — FK session_id → academic_sessions. Amounts in kobo.
- hostel_applications (id, student_id, session_id, choice_1_id, choice_2_id, choice_3_id, special_notes, status, submitted_at) — FK student_id → users, session_id → academic_sessions
- confirmed_payments (id, student_id, session_id, hms_reference, paystack_id, total_amount_kobo, payment_channel, paystack_status, status, confirmed_at) — FK student_id → users, session_id → academic_sessions
- payment_component_log (id, payment_id, component_id, component_name, amount_kobo) — FK payment_id → confirmed_payments
- student_vectors (id, student_id, session_id, v1-v8, submitted_at) — lifestyle compatibility vectors (0.0-1.0 each). FK student_id → users
- allocations (id, student_id, bed_id, session_id, payment_id, matched_from_preference, avg_compatibility_score, status, revocation_reason, revoked_by, revoked_at, allocated_at) — FK student_id → users, bed_id → beds
- compatibility_scores (id, student_a_id, student_b_id, session_id, score, computed_at) — pairwise roommate scores (0-100)
- audit_logs (id, timestamp, actor_type, actor_id, action_type, target_entity, target_id, description, metadata, session_id)

Notes:
- Amounts in kobo (divide by 100 for Naira)
- Gender values: 'male' or 'female'
- Role values: 'student' or 'admin'
- Bed status: 'vacant', 'occupied', 'maintenance'
- Allocation status: 'active', 'revoked', 'expired'
- Payment status: 'confirmed', 'pending', 'failed', 'reversed'
"""

MUTATION_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
    "CREATE", "GRANT", "REVOKE", "EXEC", "EXECUTE", "CALL",
]


def validate_sql(sql: str) -> tuple[bool, str]:
    """Validate that the SQL is a read-only SELECT query."""
    clean = sql.strip().rstrip(";").strip()

    if not clean.upper().startswith("SELECT"):
        return False, "Only SELECT queries are allowed."

    upper = clean.upper()
    for keyword in MUTATION_KEYWORDS:
        if re.search(r'\b' + keyword + r'\b', upper):
            return False, f"Mutation keyword '{keyword}' detected. Only read-only queries are permitted."

    return True, ""


def generate_sql(user_query: str) -> dict:
    """Use OpenRouter (Gemini) to generate a SQL query from plain English."""
    if not OPENROUTER_API_KEY:
        return {"error": "OpenRouter API key not configured"}

    prompt = f"""You are a SQL query generator for a hostel management system.
Given the following PostgreSQL database schema:

{DB_SCHEMA}

Convert the following plain English question into a valid PostgreSQL SELECT query.
Rules:
1. ONLY generate SELECT queries. Never generate INSERT, UPDATE, DELETE, DROP, or any mutation.
2. Use appropriate JOINs when combining data from multiple tables.
3. Use descriptive column aliases for readability.
4. Limit results to 100 rows unless the user specifically asks for more.
5. For monetary amounts, divide kobo by 100 and label as Naira.
6. Return ONLY the SQL query, nothing else. No markdown, no explanation.

User question: {user_query}
"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1024,
        )
        sql = response.choices[0].message.content.strip()

        # Strip markdown code fences if the model wraps the SQL
        if sql.startswith("```"):
            lines = sql.split("\n")
            sql = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
            sql = sql.strip()

        return {"sql": sql}
    except Exception as e:
        return {"error": f"AI query error: {str(e)}"}
