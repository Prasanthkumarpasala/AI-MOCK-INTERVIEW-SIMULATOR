import os
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from core.config import settings
from core.database import init_db
from routers.auth_router import router as auth_router
from routers.interview_router import (
    router as interview_router,
    proctor,
    warning_counters,
)
from routers.report_router import router as report_router

# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="AI-powered mock interview simulator with RAG, proctoring, scoring & learning paths.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Directories ─────────────────────────────────────────────────────────────

os.makedirs("static/audio", exist_ok=True)
os.makedirs("static/reports", exist_ok=True)
os.makedirs("uploads", exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")

# ─── Startup ─────────────────────────────────────────────────────────────────


@app.on_event("startup")
def startup():
    init_db()
    print(f"🚀 {settings.PROJECT_NAME} v{settings.VERSION} started")


# ─── Routers ─────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(interview_router)
app.include_router(report_router)

# ─── Root ─────────────────────────────────────────────────────────────────────


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": f"{settings.PROJECT_NAME} API is running",
        "version": settings.VERSION,
    }


# ─── WebSocket Proctor ────────────────────────────────────────────────────────


@app.websocket("/ws/proctor/{interview_id}")
async def proctoring_socket(websocket: WebSocket, interview_id: int):
    await websocket.accept()
    while True:
        try:
            data = await websocket.receive_json()
            alert = proctor.analyze_frame(data["image"])
            count = warning_counters.get(interview_id, 0)
            await websocket.send_json(
                {"alert": alert, "warning_count": count, "terminate": count >= 3}
            )
        except Exception:
            break
