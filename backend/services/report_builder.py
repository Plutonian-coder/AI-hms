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
            "cp.hms_reference": "HMS Reference",
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
}

# ══════════════════════════════════════════════════════════════
# FILTER CATALOGUE — whitelist of filterable fields
# ══════════════════════════════════════════════════════════════

FILTER_CATALOGUE = {
    "session_time": {
        "label": "Session & Time",
        "filters": {
            "session_id": {"type": "select", "label": "Academic Session", "column": "s.id"},
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
            "study_type": {"type": "select", "label": "Study Type", "column": "u.study_type", "options": ["Full-time", "Part-time", "Sandwich"]},
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
    return {
        "filters": {
            k: {
                "label": v["label"],
                "filters": {
                    fk: {kk: vv for kk, vv in fv.items() if kk != "column" and kk != "op"}
                    for fk, fv in v["filters"].items()
                },
            }
            for k, v in FILTER_CATALOGUE.items()
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

    return joins


def _build_join_clause(joins: set) -> str:
    """Build SQL JOIN clauses."""
    parts = ["FROM users u"]

    if "sessions" in joins or "payments" in joins or "allocations" in joins:
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

    # Determine joins
    joins = _determine_joins(valid_cols, filters)
    join_clause = _build_join_clause(joins)

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
    writer.writerow(["HMS Report Export"])
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
