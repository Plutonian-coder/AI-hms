"""
Report Router — Structured report builder with filter/column catalogue,
live preview, and CSV export.
"""
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import io

from database import get_cursor
from dependencies import get_current_admin
from services.report_builder import get_catalogue, build_report, format_csv
from services.audit_logger import log_event, REPORT_GENERATED

router = APIRouter(prefix="/api/v1/admin/reports", tags=["reports"])


class ReportRequest(BaseModel):
    columns: list[str]
    filters: dict = {}
    limit: Optional[int] = 50


@router.get("/catalogue")
def get_report_catalogue(admin=Depends(get_current_admin)):
    """Return the full filter and column catalogue."""
    return get_catalogue()


@router.post("/preview")
def preview_report(data: ReportRequest, admin=Depends(get_current_admin)):
    """Generate a live preview of the report (first N rows + aggregates)."""
    result = build_report(data.columns, data.filters, data.limit or 50)

    if "error" in result:
        return {"error": result["error"], "rows": [], "total": 0}

    with get_cursor() as cur:
        # Get total count
        cur.execute(result["count_query"], result["params"])
        total = cur.fetchone()[0]

        # Get preview rows
        query = result["query"] + f" LIMIT {result['limit']}"
        cur.execute(query, result["params"])
        rows = cur.fetchall()

    # Compute aggregates
    aggregates = {"Total Rows": total}

    # Financial aggregates
    for i, col in enumerate(result["columns"]):
        alias = result["aliases"][i]
        if "amount" in col.lower() or "kobo" in col.lower() or "₦" in alias:
            total_sum = sum(float(r[i]) for r in rows if r[i] is not None)
            aggregates[f"Sum: {alias}"] = f"₦{total_sum:,.2f}"
        if "compatibility" in col.lower() or "score" in col.lower():
            vals = [float(r[i]) for r in rows if r[i] is not None]
            if vals:
                aggregates[f"Avg: {alias}"] = f"{sum(vals) / len(vals):.1f}%"

    return {
        "columns": result["aliases"],
        "rows": [[str(v) if v is not None else "-" for v in row] for row in rows],
        "total": total,
        "aggregates": aggregates,
        "showing": min(len(rows), result["limit"]),
    }


@router.post("/export")
def export_report(data: ReportRequest, admin=Depends(get_current_admin)):
    """Export the full report as CSV."""
    result = build_report(data.columns, data.filters, limit=None)

    if "error" in result:
        return {"error": result["error"]}

    with get_cursor() as cur:
        # Get all rows (no limit)
        cur.execute(result["query"], result["params"])
        rows = cur.fetchall()

        cur.execute(result["count_query"], result["params"])
        total = cur.fetchone()[0]

    # Compute aggregates
    aggregates = {"Total Rows": total}
    for i, col in enumerate(result["columns"]):
        alias = result["aliases"][i]
        if "amount" in col.lower() or "kobo" in col.lower() or "₦" in alias:
            total_sum = sum(float(r[i]) for r in rows if r[i] is not None)
            aggregates[f"Sum: {alias}"] = f"₦{total_sum:,.2f}"
        if "compatibility" in col.lower() or "score" in col.lower():
            vals = [float(r[i]) for r in rows if r[i] is not None]
            if vals:
                aggregates[f"Avg: {alias}"] = f"{sum(vals) / len(vals):.1f}%"

    csv_content = format_csv(result["aliases"], rows, aggregates)

    # Log the export
    log_event(
        REPORT_GENERATED, "admin", admin["identifier"],
        f"Exported report with {len(result['columns'])} columns, {total} rows",
        metadata={"columns": result["aliases"], "row_count": total},
    )

    return StreamingResponse(
        io.BytesIO(csv_content.encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=hms_report.csv"},
    )
