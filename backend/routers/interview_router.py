"""
Interview router — setup, start, chat, warning, end, history.
"""

import json
import sqlite3
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, WebSocket
from pydantic import BaseModel
from typing import Optional

from core.database import get_db
from core.auth import get_current_user
from core.config import settings
from agents.interviewer import interviewer
from agents.screener import ScreenerAgent
from agents.rag_store import rag_store
from agents.scorer import scorer
from agents.learning_path import learning_path_agent
from agents.report_generator import report_generator
from agents.proctor import ProctorAgent

router = APIRouter(prefix="/api/interview", tags=["interview"])
screener = ScreenerAgent()
proctor = ProctorAgent()

# In-memory proctor warning counters: {interview_id: count}
warning_counters = {}

# ─── Setup ───────────────────────────────────────────────────────────────────


class SetupRequest(BaseModel):
    duration_minutes: int = 10
    interview_type: str = "mixed"
    skills: str = ""


@router.post("/setup")
def setup_interview(
    req: SetupRequest,
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    valid_types = ["technical", "hr", "mixed"]
    if req.interview_type not in valid_types:
        raise HTTPException(400, f"interview_type must be one of {valid_types}")
    valid_durations = [5, 10, 15, 20, 30, 45, 60]
    if req.duration_minutes not in valid_durations:
        raise HTTPException(400, f"duration_minutes must be one of {valid_durations}")

    cursor = db.execute(
        "INSERT INTO interviews (user_id, status, interview_type, skills, duration_minutes) VALUES (?, 'setup', ?, ?, ?)",
        (current_user["id"], req.interview_type, req.skills, req.duration_minutes),
    )
    db.commit()
    return {
        "interview_id": cursor.lastrowid,
        "message": "Interview created. Upload resume to start.",
    }


# ─── Start ───────────────────────────────────────────────────────────────────


@router.post("/start/{interview_id}")
async def start_interview(
    interview_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    interview = db.execute(
        "SELECT * FROM interviews WHERE id = ? AND user_id = ?",
        (interview_id, current_user["id"]),
    ).fetchone()
    if not interview:
        raise HTTPException(404, "Interview not found")
    interview = dict(interview)

    # Save resume
    os.makedirs("uploads", exist_ok=True)
    path = f"uploads/resume_{current_user['id']}_{interview_id}.pdf"
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)

    # Extract + RAG store
    resume_text = screener.extract_text_from_pdf(path)
    rag_store.store_resume(current_user["id"], resume_text)

    # Build system prompt
    system_prompt = interviewer.build_system_prompt(
        interview["interview_type"], interview["skills"], interview["duration_minutes"]
    )
    history = [{"role": "system", "content": system_prompt}]

    # First AI message
    greet = "Hello! Please start the interview by telling me a bit about the candidate."
    ai_text = interviewer.get_response(history, greet)
    audio_path = interviewer.text_to_audio(ai_text)

    # Store in DB
    db.execute(
        "UPDATE interviews SET status='active', started_at=?, round=1 WHERE id=?",
        (datetime.utcnow().isoformat(), interview_id),
    )
    db.execute(
        "INSERT INTO interview_messages (interview_id, role, content) VALUES (?, 'ai', ?)",
        (interview_id, ai_text),
    )
    db.commit()

    warning_counters[interview_id] = 0

    return {
        "question": ai_text,
        "audio_url": f"{settings.BASE_URL}/{audio_path}",
        "round": 1,
        "is_finished": False,
        "interview_id": interview_id,
    }


# ─── Chat ────────────────────────────────────────────────────────────────────


@router.post("/chat")
async def chat(
    interview_id: int = Form(...),
    user_answer: str = Form(...),
    elapsed_seconds: int = Form(0),
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    interview = db.execute(
        "SELECT * FROM interviews WHERE id = ? AND user_id = ?",
        (interview_id, current_user["id"]),
    ).fetchone()
    if not interview:
        raise HTTPException(404, "Interview not found")
    interview = dict(interview)

    duration_seconds = interview["duration_minutes"] * 60
    remaining_seconds = max(0, duration_seconds - elapsed_seconds)
    time_warning = 0 < remaining_seconds <= 60
    is_finished = remaining_seconds == 0

    # Save user message
    db.execute(
        "INSERT INTO interview_messages (interview_id, role, content) VALUES (?, 'user', ?)",
        (interview_id, user_answer),
    )

    if is_finished:
        # Time's up — end gracefully
        close_text = "Time is up! Thank you for your responses today. Your interview session has ended. Your detailed report will be ready shortly."
        audio_path = interviewer.text_to_audio(close_text)
        db.execute(
            "INSERT INTO interview_messages (interview_id, role, content) VALUES (?, 'ai', ?)",
            (interview_id, close_text),
        )
        db.execute(
            "UPDATE interviews SET status='completed', ended_at=? WHERE id=?",
            (datetime.utcnow().isoformat(), interview_id),
        )
        db.commit()
        _generate_report(interview_id, current_user, interview, db)
        return {
            "question": close_text,
            "audio_url": f"{settings.BASE_URL}/{audio_path}",
            "round": interview["round"] + 1,
            "is_finished": True,
            "time_remaining": 0,
        }

    # Rebuild history from DB
    msgs = db.execute(
        "SELECT role, content FROM interview_messages WHERE interview_id = ? ORDER BY id",
        (interview_id,),
    ).fetchall()
    system_prompt = interviewer.build_system_prompt(
        interview["interview_type"], interview["skills"], interview["duration_minutes"]
    )
    history = [{"role": "system", "content": system_prompt}]
    for m in msgs:
        role = "assistant" if m["role"] == "ai" else m["role"]
        history.append({"role": role, "content": m["content"]})

    # RAG context
    resume_context = rag_store.retrieve_context(current_user["id"], user_answer)

    # Get AI response
    ai_text = interviewer.get_response(
        history,
        user_answer,
        resume_context=resume_context,
        time_warning=time_warning,
        is_last=time_warning,
    )
    audio_path = interviewer.text_to_audio(ai_text)

    new_round = interview["round"] + 1
    db.execute(
        "INSERT INTO interview_messages (interview_id, role, content) VALUES (?, 'ai', ?)",
        (interview_id, ai_text),
    )
    db.execute("UPDATE interviews SET round=? WHERE id=?", (new_round, interview_id))
    db.commit()

    return {
        "question": ai_text,
        "audio_url": f"{settings.BASE_URL}/{audio_path}",
        "round": new_round,
        "is_finished": False,
        "time_remaining": remaining_seconds,
        "time_warning": time_warning,
    }


# ─── Warning ─────────────────────────────────────────────────────────────────


@router.post("/warning/{interview_id}")
def add_warning(
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

    warning_counters[interview_id] = warning_counters.get(interview_id, 0) + 1
    count = warning_counters[interview_id]

    db.execute(
        "UPDATE interviews SET warning_count = ? WHERE id = ?", (count, interview_id)
    )
    db.commit()

    if count >= 3:
        # Auto-terminate
        db.execute(
            "UPDATE interviews SET status='terminated', termination_reason='proctoring_violation', ended_at=? WHERE id=?",
            (datetime.utcnow().isoformat(), interview_id),
        )
        db.commit()
        _generate_report(interview_id, current_user, dict(interview), db)
        return {
            "warning_count": count,
            "terminate": True,
            "message": "Interview terminated due to 3 proctoring violations.",
        }

    return {"warning_count": count, "terminate": False}


# ─── End ─────────────────────────────────────────────────────────────────────


@router.post("/end/{interview_id}")
def end_interview(
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
    interview = dict(interview)

    db.execute(
        "UPDATE interviews SET status='completed', ended_at=? WHERE id=?",
        (datetime.utcnow().isoformat(), interview_id),
    )
    db.commit()

    report_id = _generate_report(interview_id, current_user, interview, db)
    return {"message": "Interview ended", "report_id": report_id}


# ─── History ─────────────────────────────────────────────────────────────────


@router.get("/history")
def get_history(
    current_user: dict = Depends(get_current_user),
    db: sqlite3.Connection = Depends(get_db),
):
    interviews = db.execute(
        """SELECT i.*, r.overall_score, r.id as report_id
           FROM interviews i
           LEFT JOIN interview_reports r ON r.interview_id = i.id
           WHERE i.user_id = ?
           ORDER BY i.created_at DESC""",
        (current_user["id"],),
    ).fetchall()
    return {"interviews": [dict(row) for row in interviews]}


# ─── Single interview ─────────────────────────────────────────────────────────


@router.get("/{interview_id}")
def get_interview(
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
    return dict(interview)


# ─── WebSocket Proctor ───────────────────────────────────────────────────────

# Note: WebSocket is registered in main.py for flexibility

# ─── Internal helper ─────────────────────────────────────────────────────────


def _generate_report(
    interview_id: int, current_user: dict, interview: dict, db: sqlite3.Connection
) -> int:
    """Score interview, generate learning path and PDF. Returns report DB id."""
    try:
        # Get transcript
        msgs = db.execute(
            "SELECT role, content FROM interview_messages WHERE interview_id = ? ORDER BY id",
            (interview_id,),
        ).fetchall()
        transcript = [{"role": m["role"], "content": m["content"]} for m in msgs]

        # Score
        scores = scorer.score_interview(
            transcript,
            interview.get("interview_type", "mixed"),
            interview.get("skills", ""),
        )

        # Learning path
        lp = learning_path_agent.generate(
            scores,
            interview.get("skills", ""),
            interview.get("interview_type", "mixed"),
            scores.get("improvements", []),
        )

        # PDF
        pdf_path = report_generator.generate(
            current_user, interview, scores, transcript, lp
        )

        # Save to DB
        existing = db.execute(
            "SELECT id FROM interview_reports WHERE interview_id = ?", (interview_id,)
        ).fetchone()
        if existing:
            db.execute(
                """UPDATE interview_reports SET
                overall_score=?, technical_score=?, communication_score=?, hr_score=?,
                strengths=?, improvements=?, summary=?, learning_path=?, pdf_path=?
                WHERE interview_id=?""",
                (
                    scores["overall_score"],
                    scores["technical_score"],
                    scores["communication_score"],
                    scores["hr_score"],
                    json.dumps(scores["strengths"]),
                    json.dumps(scores["improvements"]),
                    scores["summary"],
                    json.dumps(lp),
                    pdf_path,
                    interview_id,
                ),
            )
            db.commit()
            return existing["id"]
        else:
            cursor = db.execute(
                """INSERT INTO interview_reports
                (interview_id, overall_score, technical_score, communication_score, hr_score,
                 strengths, improvements, summary, learning_path, pdf_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    interview_id,
                    scores["overall_score"],
                    scores["technical_score"],
                    scores["communication_score"],
                    scores["hr_score"],
                    json.dumps(scores["strengths"]),
                    json.dumps(scores["improvements"]),
                    scores["summary"],
                    json.dumps(lp),
                    pdf_path,
                ),
            )
            db.commit()
            return cursor.lastrowid
    except Exception as e:
        print(f"Report generation error: {e}")
        return -1
