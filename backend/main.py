import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from agents.interviewer import InterviewerAgent
from agents.proctor import ProctorAgent
from agents.screener import ScreenerAgent

# Load .env from backend directory
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

app = FastAPI(title="AI Mock Interview Simulator", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure directories exist
os.makedirs("static/audio", exist_ok=True)
os.makedirs("uploads", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")

# Initialize agents
interviewer = InterviewerAgent()
proctor = ProctorAgent()
screener = ScreenerAgent()

@app.get("/")
async def root():
    return {"status": "ok", "message": "AI Mock Interview Simulator API is running"}

@app.post("/api/start")
async def start_interview(file: UploadFile = File(...)):
    """Upload resume PDF and start the interview session."""
    path = os.path.join("uploads", file.filename)
    with open(path, "wb") as f:
        f.write(await file.read())

    resume_text = screener.extract_text_from_pdf(path)
    analysis = screener.analyze_resume(resume_text)

    prompt = (
        f"Resume Analysis: {analysis}. "
        "Greet the candidate warmly by name if found, then ask the first relevant technical interview question."
    )
    ai_text, audio_path = interviewer.get_response_and_audio(prompt)

    return {
        "question": ai_text,
        "audio_url": f"{os.environ.get('BASE_URL', 'http://localhost:8000')}/{audio_path}",
        "round": 1,
        "is_finished": False,
    }

@app.post("/api/chat")
async def chat(user_answer: str = Form(...), round: int = Form(...)):
    """Process candidate's voice answer and return the next question."""
    print(f"[CHAT] Round {round} | Answer: {user_answer[:80]}...")

    if round >= 5:
        prompt = (
            f"The candidate's final answer: '{user_answer}'. "
            "Now give a comprehensive, constructive performance review. "
            "Mention strengths, areas for improvement, and an overall score out of 10."
        )
        ai_text, audio_path = interviewer.get_response_and_audio(prompt)
        return {
            "question": ai_text,
            "audio_url": f"{os.environ.get('BASE_URL', 'http://localhost:8000')}/{audio_path}",
            "round": 6,
            "is_finished": True,
        }

    ai_text, audio_path = interviewer.get_response_and_audio(user_answer)
    return {
        "question": ai_text,
        "audio_url": f"{os.environ.get('BASE_URL', 'http://localhost:8000')}/{audio_path}",
        "round": round + 1,
        "is_finished": False,
    }

@app.websocket("/ws/proctor")
async def proctoring_socket(websocket: WebSocket):
    """WebSocket endpoint for real-time face proctoring."""
    await websocket.accept()
    while True:
        try:
            data = await websocket.receive_json()
            alert = proctor.analyze_frame(data["image"])
            await websocket.send_json({"alert": alert})
        except Exception:
            break