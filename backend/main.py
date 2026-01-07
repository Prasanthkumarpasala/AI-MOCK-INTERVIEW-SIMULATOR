import os
from fastapi import FastAPI, WebSocket, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from agents.interviewer import InterviewerAgent
from agents.proctor import ProctorAgent
from agents.screener import ScreenerAgent

app = FastAPI()

# FORCE ALLOW ALL ORIGINS FOR LOCALHOST
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not os.path.exists("static"): os.makedirs("static")
app.mount("/static", StaticFiles(directory="static"), name="static")

interviewer = InterviewerAgent()
proctor = ProctorAgent()
screener = ScreenerAgent()

@app.post("/api/start")
async def start_interview(file: UploadFile = File(...)):
    path = os.path.join("uploads", file.filename)
    if not os.path.exists("uploads"): os.makedirs("uploads")
    with open(path, "wb") as f:
        f.write(await file.read())
    
    analysis = screener.analyze_resume(screener.extract_text_from_pdf(path))
    prompt = f"Resume Analysis: {analysis}. Greet the candidate and ask the first question."
    ai_text, audio_url = interviewer.get_response_and_audio(prompt)
    
    return {"question": ai_text, "audio_url": f"http://localhost:8000/{audio_url}", "round": 1}

@app.post("/api/chat")
async def chat(user_answer: str = Form(...), round: int = Form(...)):
    # DEBUG PRINT - If you don't see this, the frontend didn't send the request!
    print(f"--- CHAT ROUTE TRIGGERED: Round {round} ---") 
    
    if round >= 5:
        ai_text, audio_url = interviewer.get_response_and_audio(f"Final Answer: {user_answer}. Score out of 10.")
        return {"question": ai_text, "audio_url": f"http://localhost:8000/{audio_url}", "round": 6, "is_finished": True}
    
    ai_text, audio_url = interviewer.get_response_and_audio(user_answer)
    return {"question": ai_text, "audio_url": f"http://localhost:8000/{audio_url}", "round": round + 1, "is_finished": False}

@app.websocket("/ws/proctor")
async def proctoring_socket(websocket: WebSocket):
    await websocket.accept()
    while True:
        try:
            data = await websocket.receive_json()
            alert = proctor.analyze_frame(data['image'])
            await websocket.send_json({"alert": alert})
        except:
            break