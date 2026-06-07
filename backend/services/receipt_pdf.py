"""
Receipt PDF Generator — Premium A4 receipt using ReportLab.

Generates a clean, professional hostel payment receipt with:
- Branded HMS header with session info
- QR-code-style reference badge
- Student details table
- Itemised fee breakdown
- Official footer with watermark
"""
import io
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


# ── Colour palette (matching HMS forest / lime theme) ────────────────────────
FOREST       = colors.HexColor("#1B4332")
FOREST_LIGHT = colors.HexColor("#2D6A4F")
LIME_SOFT    = colors.HexColor("#D8F3DC")
LIME_BORDER  = colors.HexColor("#B7E4C7")
LIME_ACCENT  = colors.HexColor("#52B788")
TEXT_DARK     = colors.HexColor("#0D1F14")
TEXT_MUTED    = colors.HexColor("#6B7C72")
BG_LIGHT     = colors.HexColor("#F2F6F3")
WHITE        = colors.white


def _header_block(receipt: dict) -> list:
    """Build the branded header elements."""
    elements = []

    # Institution name row (centered)
    hms_style = ParagraphStyle(
        "HMSTitle", fontName="Helvetica-Bold", fontSize=26,
        textColor=FOREST, alignment=TA_CENTER, spaceAfter=2 * mm,
        leading=30
    )
    elements.append(Paragraph("<i>HMS</i>", hms_style))

    sub_style = ParagraphStyle(
        "SubTitle", fontName="Helvetica", fontSize=9,
        textColor=TEXT_MUTED, alignment=TA_CENTER, spaceAfter=1 * mm,
        leading=12
    )
    elements.append(Paragraph("HOSTEL MANAGEMENT SYSTEM", sub_style))

    # Session badge
    session_style = ParagraphStyle(
        "Session", fontName="Helvetica-Bold", fontSize=8,
        textColor=FOREST_LIGHT, alignment=TA_CENTER, spaceAfter=6 * mm,
        leading=10
    )
    session_name = receipt.get("session_name", "2025/2026")
    elements.append(Paragraph(f"Academic Session: {session_name}", session_style))

    # Divider
    elements.append(HRFlowable(
        width="100%", thickness=1.5, color=FOREST,
        spaceAfter=4 * mm, spaceBefore=0
    ))

    # Title
    title_style = ParagraphStyle(
        "ReceiptTitle", fontName="Helvetica-Bold", fontSize=16,
        textColor=FOREST, alignment=TA_CENTER, spaceAfter=4 * mm,
        leading=20
    )
    elements.append(Paragraph("PAYMENT RECEIPT", title_style))

    return elements


def _reference_badge(receipt: dict) -> list:
    """Prominent HMS reference block."""
    elements = []

    ref = receipt.get("hms_reference", "—")
    badge_data = [
        [Paragraph("HMS REFERENCE", ParagraphStyle(
            "RefLabel", fontName="Helvetica-Bold", fontSize=7,
            textColor=FOREST_LIGHT, alignment=TA_CENTER, leading=9
        ))],
        [Paragraph(ref, ParagraphStyle(
            "RefValue", fontName="Courier-Bold", fontSize=16,
            textColor=FOREST, alignment=TA_CENTER, leading=20
        ))],
    ]

    badge_table = Table(badge_data, colWidths=[120 * mm])
    badge_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIME_SOFT),
        ("BOX", (0, 0), (-1, -1), 1, LIME_BORDER),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))

    # Center the badge
    wrapper = Table([[badge_table]], colWidths=[170 * mm])
    wrapper.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(wrapper)
    elements.append(Spacer(1, 6 * mm))

    return elements


def _section_title(text: str) -> Paragraph:
    """Small, muted section header."""
    style = ParagraphStyle(
        "SectionTitle", fontName="Helvetica-Bold", fontSize=8,
        textColor=TEXT_MUTED, alignment=TA_LEFT, spaceBefore=3 * mm,
        spaceAfter=2 * mm, leading=10
    )
    return Paragraph(text.upper(), style)


def _info_table(rows: list[tuple[str, str]]) -> Table:
    """Two-column label/value table with alternating row shading."""
    label_style = ParagraphStyle(
        "InfoLabel", fontName="Helvetica-Bold", fontSize=8,
        textColor=TEXT_MUTED, leading=11
    )
    value_style = ParagraphStyle(
        "InfoValue", fontName="Helvetica-Bold", fontSize=9,
        textColor=TEXT_DARK, leading=12
    )

    data = []
    for label, value in rows:
        data.append([
            Paragraph(label, label_style),
            Paragraph(str(value or "—"), value_style),
        ])

    t = Table(data, colWidths=[55 * mm, 115 * mm])
    styles = [
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, colors.HexColor("#E8EEEB")),
    ]
    # Alternate row shading
    for i in range(len(data)):
        if i % 2 == 0:
            styles.append(("BACKGROUND", (0, i), (-1, i), BG_LIGHT))
        else:
            styles.append(("BACKGROUND", (0, i), (-1, i), WHITE))

    t.setStyle(TableStyle(styles))
    return t


def _fee_breakdown_table(components: list, total_amount: int) -> Table:
    """Itemised fee table with forest-coloured total row."""
    header_style = ParagraphStyle(
        "FeeHeader", fontName="Helvetica-Bold", fontSize=8,
        textColor=WHITE, leading=11
    )
    name_style = ParagraphStyle(
        "FeeName", fontName="Helvetica", fontSize=9,
        textColor=TEXT_DARK, leading=12
    )
    amount_style = ParagraphStyle(
        "FeeAmt", fontName="Helvetica-Bold", fontSize=9,
        textColor=TEXT_DARK, alignment=TA_RIGHT, leading=12
    )
    total_label_style = ParagraphStyle(
        "TotalLabel", fontName="Helvetica-Bold", fontSize=10,
        textColor=WHITE, leading=13
    )
    total_value_style = ParagraphStyle(
        "TotalValue", fontName="Helvetica-Bold", fontSize=11,
        textColor=colors.HexColor("#A3E635"), alignment=TA_RIGHT, leading=14
    )

    data = [
        [Paragraph("FEE COMPONENT", header_style),
         Paragraph("AMOUNT (₦)", header_style)],
    ]

    for comp in components:
        data.append([
            Paragraph(comp.get("name", "—"), name_style),
            Paragraph(f"₦{comp.get('amount', 0):,.2f}", amount_style),
        ])

    # Total row
    data.append([
        Paragraph("TOTAL PAID", total_label_style),
        Paragraph(f"₦{total_amount:,.2f}", total_value_style),
    ])

    col_widths = [115 * mm, 55 * mm]
    t = Table(data, colWidths=col_widths)

    styles = [
        # Header row
        ("BACKGROUND", (0, 0), (-1, 0), FOREST),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        # Grid lines for body
        ("LINEBELOW", (0, 0), (-1, -3), 0.5, colors.HexColor("#E8EEEB")),
        # Total row
        ("BACKGROUND", (0, -1), (-1, -1), FOREST),
        ("TEXTCOLOR", (0, -1), (-1, -1), WHITE),
        ("TOPPADDING", (0, -1), (-1, -1), 7),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 7),
        # Separator above total
        ("LINEABOVE", (0, -1), (-1, -1), 1.5, FOREST),
    ]

    # Alternate row shading for body rows
    for i in range(1, len(data) - 1):
        if i % 2 == 0:
            styles.append(("BACKGROUND", (0, i), (-1, i), BG_LIGHT))
        else:
            styles.append(("BACKGROUND", (0, i), (-1, i), WHITE))

    # Box around entire table
    styles.append(("BOX", (0, 0), (-1, -1), 1, LIME_BORDER))

    t.setStyle(TableStyle(styles))
    return t


def _hostel_choices(choices: list) -> list:
    """Hostel preference list."""
    elements = []
    if not choices:
        return elements

    elements.append(_section_title("Hostel Preferences"))

    style = ParagraphStyle(
        "Choice", fontName="Helvetica", fontSize=9,
        textColor=TEXT_DARK, leading=12
    )
    data = []
    for i, choice in enumerate(choices, 1):
        data.append([
            Paragraph(f"<b>{i}.</b>", style),
            Paragraph(choice, style),
        ])

    t = Table(data, colWidths=[12 * mm, 158 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 4 * mm))

    return elements


def _footer() -> list:
    """Official footer with timestamp and disclaimer."""
    elements = []

    elements.append(Spacer(1, 6 * mm))
    elements.append(HRFlowable(
        width="100%", thickness=0.5, color=LIME_BORDER,
        spaceAfter=4 * mm, spaceBefore=0
    ))

    footer_style = ParagraphStyle(
        "Footer", fontName="Helvetica", fontSize=7,
        textColor=TEXT_MUTED, alignment=TA_CENTER, leading=10
    )
    now = datetime.now().strftime("%d %b %Y at %I:%M %p")
    elements.append(Paragraph(
        "This is a computer-generated receipt and does not require a signature.", footer_style
    ))
    elements.append(Paragraph(
        f"Generated by HMS — Hostel Management System  •  {now}", footer_style
    ))

    # Subtle branding footer
    elements.append(Spacer(1, 8 * mm))
    brand_style = ParagraphStyle(
        "Brand", fontName="Helvetica-Bold", fontSize=6,
        textColor=colors.HexColor("#B7E4C7"), alignment=TA_CENTER, leading=8
    )
    elements.append(Paragraph("HMS  |  HOSTEL MANAGEMENT SYSTEM  |  PAYMENT VERIFIED", brand_style))

    return elements


def generate_receipt_pdf(receipt: dict) -> bytes:
    """
    Generate a complete A4 receipt PDF.

    Args:
        receipt: dict with keys: hms_reference, paystack_reference, amount,
                 student_name, identifier, department, level, study_type,
                 session_name, paid_at, payment_channel, components, hostel_choices

    Returns:
        PDF as bytes
    """
    buf = io.BytesIO()

    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=20 * mm, bottomMargin=15 * mm,
        leftMargin=20 * mm, rightMargin=20 * mm,
        title="HMS Payment Receipt",
        author="HMS — Hostel Management System",
    )

    elements = []

    # ── 1. Header ────────────────────────────────────────────────────────────
    elements.extend(_header_block(receipt))

    # ── 2. HMS Reference Badge ───────────────────────────────────────────────
    elements.extend(_reference_badge(receipt))

    # ── 3. Student Information ───────────────────────────────────────────────
    elements.append(_section_title("Student Information"))
    student_rows = [
        ("Student Name", receipt.get("student_name", "—")),
        ("Matric Number", receipt.get("identifier", "—")),
        ("Department", receipt.get("department", "—")),
        ("Level", receipt.get("level", "—")),
        ("Study Type", receipt.get("study_type", "—")),
        ("Academic Session", receipt.get("session_name", "—")),
    ]
    elements.append(_info_table(student_rows))
    elements.append(Spacer(1, 4 * mm))

    # ── 4. Payment Details ───────────────────────────────────────────────────
    elements.append(_section_title("Payment Details"))
    paid_at = receipt.get("paid_at")
    if paid_at:
        try:
            dt = datetime.fromisoformat(paid_at)
            paid_at_str = dt.strftime("%d %b %Y, %I:%M %p")
        except Exception:
            paid_at_str = str(paid_at)
    else:
        paid_at_str = "—"

    payment_rows = [
        ("Paystack Reference", receipt.get("paystack_reference", "—")),
        ("Payment Channel", (receipt.get("payment_channel") or "—").title()),
        ("Payment Date", paid_at_str),
        ("Payment Status", "CONFIRMED ✓"),
    ]
    elements.append(_info_table(payment_rows))
    elements.append(Spacer(1, 4 * mm))

    # ── 5. Fee Breakdown ─────────────────────────────────────────────────────
    components = receipt.get("components", [])
    if components:
        elements.append(_section_title("Fee Breakdown"))
        total = receipt.get("amount", 0)
        elements.append(_fee_breakdown_table(components, total))
        elements.append(Spacer(1, 4 * mm))

    # ── 6. Hostel Choices ────────────────────────────────────────────────────
    elements.extend(_hostel_choices(receipt.get("hostel_choices", [])))

    # ── 7. Footer ────────────────────────────────────────────────────────────
    elements.extend(_footer())

    # Build PDF
    doc.build(elements)
    buf.seek(0)
    return buf.read()
