"""
Report Builder Service — Dynamic SQL construction from admin-selected
filters and columns with strict whitelisting to prevent SQL injection.
"""
import csv
import io
from typing import Optional

# ══════════════════════════════════════════════════════════════
# COLUMN CATALOGUE — whitelist of selectable columns
# ══════════════════════════════════════════════════════════════

COLUMN_CATALOGUE = {
    "student_identity": {
        "label": "Student Identity",
        "columns": {
            "u.identifier": "Matric Number",
            "u.surname || ' ' || u.first_name": "Full Name",
            "u.gender": "Gender",
            "u.department": "Department",
            "u.level": "Level",
            "u.study_type": "Study Type",
            "u.email": "Email",
            "u.phone": "Phone",
        },
    },
    "payment": {
        "label": "Payment",
        "columns": {
            "cp.hms_reference": "Payment Reference",
            "cp.total_amount_kobo / 100": "Amount (₦)",
            "cp.payment_channel": "Channel",
            "cp.status": "Payment Status",
            "cp.confirmed_at": "Payment Date",
        },
    },
    "allocation": {
        "label": "Allocation",
        "columns": {
            "h.name": "Hostel",
            "bl.name": "Block",
            "r.room_number": "Room",
            "b.bed_number": "Bed",
            "a.matched_from_preference": "Preference Rank",
            "a.status": "Allocation Status",
            "a.allocated_at": "Allocated At",
        },
    },
    "compatibility": {
        "label": "AI & Compatibility",
        "columns": {
            "a.avg_compatibility_score": "Avg Compatibility (%)",
            "sv.v1": "Sleep Time",
            "sv.v2": "Wake Time",
            "sv.v3": "Study Noise",
            "sv.v4": "Cleanliness",
            "sv.v5": "Visitor Freq",
            "sv.v6": "Night Device",
            "sv.v7": "Social Pref",
            "sv.v8": "Noise Tolerance",
        },
    },
    "session": {
        "label": "Session",
        "columns": {
            "s.session_name": "Session",
        },
    },
    "email": {
        "label": "Email Communications",
        "columns": {
            "el.recipient_email": "Recipient Email",
            "el.recipient_matric": "Recipient Matric",
            "el.recipient_name": "Recipient Name",
            "el.subject": "Subject",
            "el.body_preview": "Mail Body (Preview)",
            "el.email_type": "Email Type",
            "el.status": "Delivery Status",
            "el.sent_at": "Sent Date",
        },
    },
}

# ══════════════════════════════════════════════════════════════
# FILTER CATALOGUE — whitelist of filterable fields
# ══════════════════════════════════════════════════════════════

FILTER_CATALOGUE = {
    "session_time": {
        "label": "Session & Time",
        "filters": {
            "session_id": {"type": "select", "label": "Academic Session", "column": "s.session_name"},
            "allocated_after": {"type": "date", "label": "Allocated After", "column": "a.allocated_at", "op": ">="},
            "allocated_before": {"type": "date", "label": "Allocated Before", "column": "a.allocated_at", "op": "<="},
            "paid_after": {"type": "date", "label": "Paid After", "column": "cp.confirmed_at", "op": ">="},
            "paid_before": {"type": "date", "label": "Paid Before", "column": "cp.confirmed_at", "op": "<="},
        },
    },
    "student_identity": {
        "label": "Student Identity",
        "filters": {
            "gender": {"type": "select", "label": "Gender", "column": "u.gender", "options": ["male", "female"]},
            "department": {"type": "text", "label": "Department", "column": "u.department", "op": "ILIKE"},
            "level": {"type": "select", "label": "Level", "column": "u.level", "options": ["100L", "200L", "300L", "400L", "500L"]},
            "study_type": {"type": "select", "label": "Study Type", "column": "u.study_type", "options": ["Full-time", "Part-time", "CODFEL"]},
        },
    },
    "status": {
        "label": "Status Flags",
        "filters": {
            "allocation_status": {"type": "select", "label": "Allocation Status", "column": "a.status", "options": ["active", "revoked", "expired"]},
            "payment_status": {"type": "select", "label": "Payment Status", "column": "cp.status", "options": ["confirmed", "pending", "failed", "reversed"]},
        },
    },
    "financial": {
        "label": "Financial",
        "filters": {
            "min_amount": {"type": "number", "label": "Min Amount (₦)", "column": "cp.total_amount_kobo / 100", "op": ">="},
            "max_amount": {"type": "number", "label": "Max Amount (₦)", "column": "cp.total_amount_kobo / 100", "op": "<="},
        },
    },
    "accommodation": {
        "label": "Accommodation",
        "filters": {
            "hostel_name": {"type": "text", "label": "Hostel Name", "column": "h.name", "op": "ILIKE"},
            "block_name": {"type": "text", "label": "Block Name", "column": "bl.name", "op": "ILIKE"},
        },
    },
    "compatibility_filters": {
        "label": "AI Compatibility",
        "filters": {
            "min_compatibility": {"type": "number", "label": "Min Compatibility (%)", "column": "a.avg_compatibility_score", "op": ">="},
            "max_compatibility": {"type": "number", "label": "Max Compatibility (%)", "column": "a.avg_compatibility_score", "op": "<="},
        },
    },
    "email_filters": {
        "label": "Email Communications",
        "filters": {
            "email_type": {"type": "select", "label": "Email Type", "column": "el.email_type",
                           "options": ["registration", "application_submitted", "status_change",
                                       "medical_review", "allocation_success", "allocation_revoked",
                                       "invoice", "password_reset"]},
            "email_recipient": {"type": "text", "label": "Recipient Email", "column": "el.recipient_email", "op": "ILIKE"},
            "email_sent_after": {"type": "date", "label": "Sent After", "column": "el.sent_at", "op": ">="},
            "email_sent_before": {"type": "date", "label": "Sent Before", "column": "el.sent_at", "op": "<="},
            "email_status": {"type": "select", "label": "Delivery Status", "column": "el.status",
                             "options": ["sent", "failed"]},
        },
    },
}

# All valid column expressions (for whitelist validation)
ALL_VALID_COLUMNS = set()
for cat in COLUMN_CATALOGUE.values():
    ALL_VALID_COLUMNS.update(cat["columns"].keys())

# All valid filter keys
ALL_VALID_FILTERS = set()
for cat in FILTER_CATALOGUE.values():
    ALL_VALID_FILTERS.update(cat["filters"].keys())


def get_catalogue():
    """Return the full filter and column catalogue for the frontend."""
    sessions = []
    try:
        from database import get_cursor
        with get_cursor() as cur:
            cur.execute("SELECT session_name FROM academic_sessions ORDER BY id DESC")
            sessions = [r[0] for r in cur.fetchall()]
    except Exception as e:
        print(f"Error fetching sessions for catalogue: {e}")
        sessions = []

    # Clone FILTER_CATALOGUE and inject dynamic session options
    import copy
    local_filter_catalogue = copy.deepcopy(FILTER_CATALOGUE)
    if sessions:
        local_filter_catalogue["session_time"]["filters"]["session_id"]["options"] = sessions
    else:
        local_filter_catalogue["session_time"]["filters"]["session_id"]["options"] = ["2025/2026"]

    return {
        "filters": {
            k: {
                "label": v["label"],
                "filters": {
                    fk: {kk: vv for kk, vv in fv.items() if kk != "column" and kk != "op"}
                    for fk, fv in v["filters"].items()
                },
            }
            for k, v in local_filter_catalogue.items()
        },
        "columns": {
            k: {"label": v["label"], "columns": v["columns"]}
            for k, v in COLUMN_CATALOGUE.items()
        },
    }


def _determine_joins(selected_columns: list[str], selected_filters: dict) -> set:
    """Determine which JOINs are needed based on selected columns and filters."""
    all_refs = " ".join(selected_columns) + " " + " ".join(
        FILTER_CATALOGUE.get(cat, {}).get("filters", {}).get(f, {}).get("column", "")
        for cat in FILTER_CATALOGUE
        for f in selected_filters
        if f in FILTER_CATALOGUE.get(cat, {}).get("filters", {})
    )

    joins = set()
    joins.add("users")  # always include users as base

    if "s." in all_refs:
        joins.add("sessions")
    if "cp." in all_refs:
        joins.add("payments")
    if "a." in all_refs:
        joins.add("allocations")
    if "b." in all_refs or "r." in all_refs or "bl." in all_refs or "h." in all_refs:
        joins.add("allocations")
        joins.add("accommodation")
    if "sv." in all_refs:
        joins.add("vectors")
    if "el." in all_refs:
        joins.add("email_logs")

    return joins


def _build_join_clause(joins: set, session_name: Optional[str] = None) -> str:
    """Build SQL JOIN clauses."""
    parts = ["FROM users u"]

    if any(k in joins for k in ("sessions", "payments", "allocations", "vectors", "email_logs")):
        if session_name:
            parts.append(f"LEFT JOIN academic_sessions s ON s.session_name = '{session_name}'")
        else:
            parts.append("LEFT JOIN academic_sessions s ON s.is_active = TRUE")

    if "payments" in joins:
        parts.append("LEFT JOIN confirmed_payments cp ON cp.student_id = u.id AND cp.session_id = s.id")

    if "allocations" in joins:
        parts.append("LEFT JOIN allocations a ON a.student_id = u.id AND a.session_id = s.id")

    if "accommodation" in joins:
        parts.append("LEFT JOIN beds b ON b.id = a.bed_id")
        parts.append("LEFT JOIN rooms r ON r.id = b.room_id")
        parts.append("LEFT JOIN blocks bl ON bl.id = r.block_id")
        parts.append("LEFT JOIN hostels h ON h.id = bl.hostel_id")

    if "vectors" in joins:
        parts.append("LEFT JOIN student_vectors sv ON sv.student_id = u.id AND sv.session_id = s.id")

    if "email_logs" in joins:
        parts.append("LEFT JOIN email_logs el ON el.recipient_user_id = u.id AND el.session_id = s.id")

    return "\n".join(parts)


def build_report(selected_columns: list[str], filters: dict, limit: Optional[int] = 50):
    """
    Build and execute a report query.
    Returns: { columns, aliases, rows, total, aggregates }
    """
    # Validate columns
    valid_cols = [c for c in selected_columns if c in ALL_VALID_COLUMNS]
    if not valid_cols:
        return {"error": "No valid columns selected"}

    # Build column aliases
    col_aliases = {}
    for c in valid_cols:
        for cat in COLUMN_CATALOGUE.values():
            if c in cat["columns"]:
                col_aliases[c] = cat["columns"][c]
                break

    # Build WHERE conditions
    conditions = ["u.role = 'student'"]
    params = []

    for filter_key, filter_value in filters.items():
        if filter_key not in ALL_VALID_FILTERS or not filter_value:
            continue

        # Find the filter definition
        for cat in FILTER_CATALOGUE.values():
            if filter_key in cat["filters"]:
                fdef = cat["filters"][filter_key]
                col = fdef["column"]
                op = fdef.get("op", "=")

                if fdef["type"] == "text":
                    conditions.append(f"{col} {op} %s")
                    params.append(f"%{filter_value}%")
                elif fdef["type"] in ("select", "number"):
                    conditions.append(f"{col} {op} %s")
                    params.append(filter_value)
                elif fdef["type"] == "date":
                    conditions.append(f"{col} {op} %s")
                    params.append(filter_value)
                break

    # Validate and extract session_name from filters to prevent SQL injection
    session_name = None
    if "session_id" in filters and filters["session_id"]:
        try:
            from database import get_cursor
            with get_cursor() as cur:
                cur.execute("SELECT session_name FROM academic_sessions")
                valid_sessions = {r[0] for r in cur.fetchall()}
                if filters["session_id"] in valid_sessions:
                    session_name = filters["session_id"]
        except Exception as e:
            print(f"Error validating session name in build_report: {e}")

    # Determine joins
    joins = _determine_joins(valid_cols, filters)
    join_clause = _build_join_clause(joins, session_name=session_name)

    # Build SELECT
    select_parts = [f"{c} AS col_{i}" for i, c in enumerate(valid_cols)]
    select_clause = "SELECT " + ", ".join(select_parts)

    where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""

    # Full query
    query = f"{select_clause}\n{join_clause}\n{where_clause}\nORDER BY u.id"

    # Count query
    count_query = f"SELECT COUNT(*) {join_clause}\n{where_clause}"

    return {
        "query": query,
        "count_query": count_query,
        "params": params,
        "aliases": [col_aliases[c] for c in valid_cols],
        "columns": valid_cols,
        "limit": limit,
    }


def format_csv(aliases: list[str], rows: list[list], aggregates: dict) -> str:
    """Generate CSV content with metadata header and aggregate footer."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow(["FUOYE Report Export"])
    writer.writerow([])

    # Column headers
    writer.writerow(aliases)

    # Data rows
    for row in rows:
        writer.writerow([str(v) if v is not None else "" for v in row])

    # Aggregate footer
    writer.writerow([])
    writer.writerow(["--- Aggregates ---"])
    for key, value in aggregates.items():
        writer.writerow([key, value])

    return output.getvalue()
