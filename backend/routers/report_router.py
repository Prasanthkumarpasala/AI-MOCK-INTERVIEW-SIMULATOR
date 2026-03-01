import json
import sqlite3
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from core.database import get_db
from core.auth import get_current_user
from core.config import settings

router = APIRouter(prefix="/api/report", tags=["report"])


@router.get("/{interview_id}")
def get_report(
    interview_id: int,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    # Verify ownership
    interview = db.execute(
        "SELECT * FROM interviews WHERE id = ? AND user_id = ?",
        (interview_id, current_user["id"]),
    ).fetchone()
    if not interview:
        raise HTTPException(404, "Interview not found")
    interview = dict(interview)

    report = db.execute(
        "SELECT * FROM interview_reports WHERE interview_id = ?", (interview_id,)
    ).fetchone()
    if not report:
        raise HTTPException(404, "Report not yet generated. Please wait.")
    report = dict(report)

    # Parse JSON fields
    for field in ["strengths", "improvements", "learning_path"]:
        if isinstance(report.get(field), str):
            try:
                report[field] = json.loads(report[field])
            except Exception:
                report[field] = []

    # Get transcript
    msgs = db.execute(
        "SELECT role, content, timestamp FROM interview_messages WHERE interview_id = ? ORDER BY id",
        (interview_id,),
    ).fetchall()

    return {
        "interview": interview,
        "report": report,
        "transcript": [dict(m) for m in msgs],
        "user": {
            "name": current_user["name"],
            "email": current_user["email"],
            "education": current_user.get("education", ""),
        },
    }


@router.get("/{interview_id}/download")
def download_pdf(
    interview_id: int,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    interview = db.execute(
        "SELECT * FROM interviews WHERE id = ? AND user_id = ?",
        (interview_id, current_user["id"]),
    ).fetchone()
    if not interview:
        raise HTTPException(404, "Interview not found")

    report = db.execute(
        "SELECT pdf_path FROM interview_reports WHERE interview_id = ?", (interview_id,)
    ).fetchone()
    if not report or not report["pdf_path"]:
        raise HTTPException(404, "PDF report not available yet")

    pdf_path = report["pdf_path"]
    if not pdf_path.startswith("/"):
        # relative path from backend dir
        import os
        from pathlib import Path

        backend_dir = Path(__file__).parent.parent
        pdf_path = str(backend_dir / pdf_path)

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"interview_report_{interview_id}.pdf",
    )
