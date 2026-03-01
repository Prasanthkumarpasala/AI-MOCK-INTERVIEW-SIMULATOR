"""
ReportGenerator — creates a PDF interview report using reportlab.
"""

import os
import json
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    PageBreak,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT


class ReportGenerator:
    def generate(
        self,
        user: dict,
        interview: dict,
        report_data: dict,
        transcript: list,
        learning_path: list,
    ) -> str:
        """Generate a PDF report and return the file path."""
        os.makedirs("static/reports", exist_ok=True)
        filename = f"report_interview_{interview['id']}_{user['id']}.pdf"
        filepath = f"static/reports/{filename}"

        doc = SimpleDocTemplate(
            filepath,
            pagesize=A4,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
            leftMargin=2 * cm,
            rightMargin=2 * cm,
        )
        styles = getSampleStyleSheet()

        # Custom styles
        title_style = ParagraphStyle(
            "Title",
            parent=styles["Title"],
            fontSize=22,
            textColor=colors.HexColor("#6366F1"),
            spaceAfter=6,
            alignment=TA_CENTER,
        )
        h2_style = ParagraphStyle(
            "H2",
            parent=styles["Heading2"],
            fontSize=14,
            textColor=colors.HexColor("#4F46E5"),
            spaceBefore=14,
            spaceAfter=6,
        )
        body_style = ParagraphStyle(
            "Body",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            spaceAfter=4,
            textColor=colors.HexColor("#374151"),
        )
        muted_style = ParagraphStyle(
            "Muted",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#6B7280"),
        )
        ai_style = ParagraphStyle(
            "AI",
            parent=styles["Normal"],
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#4F46E5"),
            leftIndent=10,
        )
        user_style = ParagraphStyle(
            "User",
            parent=styles["Normal"],
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#374151"),
            leftIndent=10,
        )

        elements = []

        # ── Header ──
        elements.append(Spacer(1, 0.5 * cm))
        elements.append(Paragraph("🤖 AI Mock Interview Report", title_style))
        elements.append(
            Paragraph(
                f"Generated on {datetime.now().strftime('%B %d, %Y at %H:%M')}",
                muted_style,
            )
        )
        elements.append(
            HRFlowable(
                width="100%",
                thickness=1,
                color=colors.HexColor("#E5E7EB"),
                spaceAfter=12,
            )
        )

        # ── Candidate Info ──
        elements.append(Paragraph("Candidate Information", h2_style))
        info_data = [
            ["Name", user.get("name", "N/A")],
            ["Email", user.get("email", "N/A")],
            ["Interview Type", interview.get("interview_type", "mixed").title()],
            ["Skills", interview.get("skills", "N/A")],
            ["Duration", f"{interview.get('duration_minutes', 0)} minutes"],
            ["Status", interview.get("status", "completed").title()],
        ]
        info_table = Table(info_data, colWidths=[5 * cm, 12 * cm])
        info_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
                    ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#374151")),
                    ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
                    (
                        "ROWBACKGROUNDS",
                        (0, 0),
                        (-1, -1),
                        [colors.white, colors.HexColor("#FAFAFA")],
                    ),
                    ("PADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        elements.append(info_table)
        elements.append(Spacer(1, 0.5 * cm))

        # ── Scores ──
        elements.append(Paragraph("Performance Scores", h2_style))
        scores = [
            ["Category", "Score", "Grade"],
            [
                "Overall Score",
                f"{report_data.get('overall_score', 0)}/100",
                self._grade(report_data.get("overall_score", 0)),
            ],
            [
                "Technical",
                f"{report_data.get('technical_score', 0)}/100",
                self._grade(report_data.get("technical_score", 0)),
            ],
            [
                "Communication",
                f"{report_data.get('communication_score', 0)}/100",
                self._grade(report_data.get("communication_score", 0)),
            ],
            [
                "HR & Behavioral",
                f"{report_data.get('hr_score', 0)}/100",
                self._grade(report_data.get("hr_score", 0)),
            ],
        ]
        score_table = Table(scores, colWidths=[7 * cm, 5 * cm, 5 * cm])
        score_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366F1")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7EB")),
                    (
                        "ROWBACKGROUNDS",
                        (0, 1),
                        (-1, -1),
                        [colors.white, colors.HexColor("#FAFAFA")],
                    ),
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("PADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        elements.append(score_table)
        elements.append(Spacer(1, 0.5 * cm))

        # ── Summary ──
        elements.append(Paragraph("Overall Assessment", h2_style))
        elements.append(Paragraph(report_data.get("summary", ""), body_style))

        # ── Strengths ──
        elements.append(Paragraph("✅ Strengths", h2_style))
        strengths = report_data.get("strengths", [])
        if isinstance(strengths, str):
            strengths = json.loads(strengths)
        for s in strengths:
            elements.append(Paragraph(f"• {s}", body_style))

        # ── Improvements ──
        elements.append(Paragraph("📈 Areas for Improvement", h2_style))
        improvements = report_data.get("improvements", [])
        if isinstance(improvements, str):
            improvements = json.loads(improvements)
        for i in improvements:
            elements.append(Paragraph(f"• {i}", body_style))

        # ── Learning Path ──
        elements.append(PageBreak())
        elements.append(Paragraph("🎯 Personalized Learning Path", h2_style))
        lp = learning_path
        if isinstance(lp, str):
            lp = json.loads(lp)
        for item in lp:
            elements.append(
                Paragraph(
                    f"<b>{item.get('category', '')} — {item.get('topic', '')}</b> "
                    f"[Priority: {item.get('priority', '')} | ~{item.get('estimated_hours', 0)}h]",
                    body_style,
                )
            )
            elements.append(Paragraph(item.get("description", ""), muted_style))
            res = item.get("resources", [])
            if res:
                elements.append(Paragraph(f"Resources: {', '.join(res)}", muted_style))
            elements.append(Spacer(1, 0.3 * cm))

        # ── Transcript ──
        elements.append(PageBreak())
        elements.append(Paragraph("💬 Interview Transcript", h2_style))
        for msg in transcript:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            label = "🤖 AI Interviewer:" if role == "ai" else "🧑 Candidate:"
            style = ai_style if role == "ai" else user_style
            elements.append(Paragraph(f"<b>{label}</b>", style))
            elements.append(Paragraph(content, style))
            elements.append(Spacer(1, 0.2 * cm))

        doc.build(elements)
        return f"static/reports/{filename}"

    def _grade(self, score: float) -> str:
        if score >= 90:
            return "A+"
        if score >= 80:
            return "A"
        if score >= 70:
            return "B"
        if score >= 60:
            return "C"
        if score >= 50:
            return "D"
        return "F"


report_generator = ReportGenerator()
