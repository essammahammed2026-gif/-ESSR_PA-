import os
import io
from datetime import datetime
from typing import Dict, Any

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

def format_file_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{round(size_bytes / 1024, 1)} KB"
    else:
        return f"{round(size_bytes / (1024 * 1024), 2)} MB"

def generate_prepress_report_pdf(analysis: Dict[str, Any]) -> bytes:
    """
    Synthesizes a clean, high-resolution A4 PDF Prepress Quality & Preflight Audit Report.
    Includes document metrics, traffic-light checklist, granular page-by-page findings,
    and remediation steps.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0F172A')
    )

    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748B')
    )

    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#1E293B')
    )

    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#334155')
    )

    body_bold = ParagraphStyle(
        'BodyBoldCustom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor('#1E293B')
    )

    table_header = ParagraphStyle(
        'TableHeaderCustom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#0F172A')
    )

    table_cell = ParagraphStyle(
        'TableCellCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10,
        textColor=colors.HexColor('#334155')
    )

    story = []

    # 1. Header Banner
    filename = analysis.get("filename", "Unknown Artwork")
    file_size_str = format_file_size(analysis.get("size_bytes", 0))
    page_count = analysis.get("page_count", 1)
    report_data = analysis.get("report", {})
    overall_status = report_data.get("overall_status", "pass")
    checks = report_data.get("checks", {})
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    header_table_data = [
        [
            Paragraph("<b>FLINT PREPRESS STUDIO</b><br/><font color='#64748B'>Technical Quality & Preflight Audit Report</font>", title_style),
            Paragraph(f"<font color='#0284C7'><b>STATUS: {'ACTION REQUIRED' if overall_status == 'warning' else 'READY FOR PRINT'}</b></font><br/><font color='#64748B'>Audited: {now_str}</font>", ParagraphStyle('RHead', parent=subtitle_style, alignment=TA_RIGHT))
        ]
    ]
    header_table = Table(header_table_data, colWidths=[340, 180])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0284C7"), spaceBefore=0, spaceAfter=12))

    # 2. Executive File Profile Summary Box
    summary = report_data.get("summary", {})
    primary_size = summary.get("primary_size", f"{analysis.get('width_mm', 0)} × {analysis.get('height_mm', 0)} mm")
    color_profile = summary.get("color_profile", analysis.get("color_space", "RGB"))
    bleed_info = f"{summary.get('bleed_mm', 0.0)} mm" if summary.get("has_bleed") else "None (0.0 mm)"

    profile_data = [
        [
            Paragraph("<b>Artwork File:</b>", body_style),
            Paragraph(f"<b>{filename}</b>", body_bold),
            Paragraph("<b>Total Pages:</b>", body_style),
            Paragraph(f"{page_count} page{'s' if page_count != 1 else ''}", body_bold),
        ],
        [
            Paragraph("<b>File Size:</b>", body_style),
            Paragraph(file_size_str, body_style),
            Paragraph("<b>Primary Dimensions:</b>", body_style),
            Paragraph(primary_size, body_bold),
        ],
        [
            Paragraph("<b>Color Model:</b>", body_style),
            Paragraph(f"<font color='{'#D97706' if color_profile == 'RGB' else '#059669'}'><b>{color_profile}</b></font>", body_bold),
            Paragraph("<b>Finished Bleed:</b>", body_style),
            Paragraph(f"<font color='{'#059669' if summary.get('has_bleed') else '#D97706'}'><b>{bleed_info}</b></font>", body_bold),
        ]
    ]

    profile_table = Table(profile_data, colWidths=[90, 170, 110, 150])
    profile_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(profile_table)
    story.append(Spacer(1, 14))

    # 3. Traffic-Light Prepress Checklist
    story.append(Paragraph("<b>1. Prepress Verification Checklist</b>", section_heading))
    story.append(Spacer(1, 6))

    geom_check = checks.get("geometry", {})
    dpi_check = checks.get("dpi", {})
    bleed_check = checks.get("bleed", {})
    color_check = checks.get("colorspace", {})

    def status_badge(status_str: str) -> Paragraph:
        if status_str == "pass":
            return Paragraph("<font color='#059669'><b>[PASS]</b></font>", body_bold)
        else:
            return Paragraph("<font color='#D97706'><b>[ATTENTION]</b></font>", body_bold)

    check_table_data = [
        [
            Paragraph("Audit Inspection", table_header),
            Paragraph("Result", table_header),
            Paragraph("Details & Technical Findings", table_header)
        ],
        [
            Paragraph("<b>Page Geometry & Trim Uniformity</b>", table_cell),
            status_badge(geom_check.get("status", "pass")),
            Paragraph(geom_check.get("details", "All pages uniform."), table_cell)
        ],
        [
            Paragraph("<b>Image Resolution (DPI / PPI)</b>", table_cell),
            status_badge(dpi_check.get("status", "pass")),
            Paragraph(dpi_check.get("details", "Resolution check complete."), table_cell)
        ],
        [
            Paragraph("<b>Bleed Margin & TrimBox</b>", table_cell),
            status_badge(bleed_check.get("status", "pass")),
            Paragraph(bleed_check.get("details", "Bleed check complete."), table_cell)
        ],
        [
            Paragraph("<b>Color Space & Separation</b>", table_cell),
            status_badge(color_check.get("status", "pass")),
            Paragraph(color_check.get("details", "Color model check complete."), table_cell)
        ]
    ]

    check_table = Table(check_table_data, colWidths=[150, 70, 300])
    check_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(check_table)
    story.append(Spacer(1, 14))

    # 4. Itemized Findings & Page-Level Issues
    story.append(Paragraph("<b>2. Itemized Page-Level Audit Breakdown</b>", section_heading))
    story.append(Spacer(1, 6))

    findings_items = []

    # Geometry Groups
    page_groups = geom_check.get("page_groups", [])
    if len(page_groups) > 1:
        findings_items.append(Paragraph("<b>• Varying Page Sizes Detected:</b>", body_bold))
        size_table_data = [
            [Paragraph("Page Range", table_header), Paragraph("Dimensions", table_header), Paragraph("Standard Size", table_header), Paragraph("Count", table_header)]
        ]
        for pg in page_groups:
            size_table_data.append([
                Paragraph(f"Pages {pg.get('pages', '')}", table_cell),
                Paragraph(pg.get('dimensions', ''), table_cell),
                Paragraph(pg.get('standard_name', ''), table_cell),
                Paragraph(str(pg.get('count', '')), table_cell)
            ])
        size_tbl = Table(size_table_data, colWidths=[140, 140, 140, 100])
        size_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        findings_items.append(size_tbl)
        findings_items.append(Spacer(1, 6))
    else:
        findings_items.append(Paragraph(f"• <b>Geometry:</b> All pages have uniform dimensions ({primary_size}).", body_style))

    # Low DPI Images List
    low_dpi_images = dpi_check.get("low_dpi_images", [])
    if low_dpi_images:
        findings_items.append(Spacer(1, 4))
        findings_items.append(Paragraph(f"<b>• Low Resolution Images (&lt;300 DPI) — {len(low_dpi_images)} instances found:</b>", body_bold))
        dpi_tbl_data = [
            [Paragraph("Page #", table_header), Paragraph("Effective DPI", table_header), Paragraph("Pixel Dimensions", table_header), Paragraph("Print Severity", table_header)]
        ]
        for img in low_dpi_images[:12]:  # Show top 12 to fit on page
            dpi_val = img.get("dpi", 0)
            sev = "Critical (<150 DPI)" if dpi_val < 150 else "Warning (<300 DPI)"
            dpi_tbl_data.append([
                Paragraph(f"Page {img.get('page', 1)}", table_cell),
                Paragraph(f"<font color='#D97706'><b>{dpi_val} DPI</b></font>", table_cell),
                Paragraph(img.get("dimensions", ""), table_cell),
                Paragraph(sev, table_cell)
            ])
        dpi_tbl = Table(dpi_tbl_data, colWidths=[90, 110, 160, 160])
        dpi_tbl.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F8FAFC')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ]))
        findings_items.append(dpi_tbl)
        if len(low_dpi_images) > 12:
            findings_items.append(Paragraph(f"<i>... and {len(low_dpi_images) - 12} additional low-resolution images.</i>", subtitle_style))
        findings_items.append(Spacer(1, 6))

    # Bleed Information
    pages_missing_bleed = bleed_check.get("pages_missing_bleed", [])
    if pages_missing_bleed:
        from engines.asset_inspector import format_page_ranges
        findings_items.append(Paragraph(f"• <b>Bleed Missing:</b> Pages {format_page_ranges(pages_missing_bleed)} have 0mm bleed margin defined. Use Flint Book Studio or Imposing Studio to synthesize mirrored bleeds.", body_style))
    else:
        findings_items.append(Paragraph("• <b>Bleed Allowance:</b> Valid bleed margins detected across document.", body_style))

    # Color Information
    rgb_pages = color_check.get("rgb_pages", [])
    if rgb_pages:
        from engines.asset_inspector import format_page_ranges
        findings_items.append(Paragraph(f"• <b>RGB Color Space:</b> Pages {format_page_ranges(rgb_pages)} contain RGB images/graphics. Converting to CMYK (e.g. FOGRA39 or SWOP) is recommended before CTP plate generation.", body_style))
    else:
        findings_items.append(Paragraph("• <b>Color Compatibility:</b> CMYK / Grayscale color model is ready for commercial plate output.", body_style))

    story.extend(findings_items)
    story.append(Spacer(1, 14))

    # 5. Remediation Recommendations
    story.append(Paragraph("<b>3. Recommended Operator Remediations</b>", section_heading))
    story.append(Spacer(1, 4))

    remedy_bullets = []
    if pages_missing_bleed:
        remedy_bullets.append("<b>Scanned Book Studio:</b> Open asset to auto-synthesize 3mm mirrored bleeds and straighten/deskew content.")
    if page_count > 1:
        remedy_bullets.append("<b>Imposing Studio:</b> Impose pages into standard publication saddle-stitch or perfect bound sheets.")
    else:
        remedy_bullets.append("<b>Imposing Studio (Gang Run):</b> Step-and-repeat single page artwork onto SRA3 or B2 press sheets with trim marks.")
    if analysis.get("has_transparency"):
        remedy_bullets.append("<b>Contour Studio:</b> Generate vector CutContour die-lines and white ink underbase mask for sticker cutting.")

    for bullet in remedy_bullets:
        story.append(Paragraph(f"→ {bullet}", body_style))
        story.append(Spacer(1, 2))

    story.append(Spacer(1, 14))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#CBD5E1"), spaceBefore=0, spaceAfter=8))
    story.append(Paragraph("Flint Prepress Studio Engine • Local-First Prepress & Print Production Suite • Generated automatically", subtitle_style))

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
