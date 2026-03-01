"""
InterviewerAgent — RAG-aware, time-limited, type-aware AI interviewer.
"""

import os
import uuid
from gtts import gTTS
from core.config import settings


class InterviewerAgent:
    def __init__(self):
        api_key = settings.GROQ_API_KEY.strip()
        if api_key and api_key.startswith("gsk_"):
            try:
                from groq import Groq

                self.client = Groq(api_key=api_key)
                self.enabled = True
            except Exception as e:
                print(f"GROQ API Error: {e}")
                self.enabled = False
                self.client = None
        else:
            self.enabled = False
            self.client = None

    def build_system_prompt(
        self, interview_type: str, skills: str, duration_minutes: int
    ) -> str:
        type_instructions = {
            "technical": (
                "You are a strict senior technical interviewer. "
                "Focus on coding concepts, system design, algorithms, data structures, and technology-specific knowledge. "
                "Ask one precise technical question at a time."
            ),
            "hr": (
                "You are a professional HR interviewer. "
                "Focus on behavioral questions, situational scenarios, communication, teamwork, leadership, and career goals. "
                "Be warm but professional. Ask one question at a time."
            ),
            "mixed": (
                "You are a comprehensive interviewer conducting both technical and HR rounds. "
                "Alternate between technical depth questions and behavioral/situational questions. "
                "Ask one question at a time."
            ),
        }
        base = type_instructions.get(interview_type, type_instructions["mixed"])
        return (
            f"{base}\n\n"
            f"The candidate's key skills are: {skills}. "
            f"The interview duration is {duration_minutes} minutes. "
            "Start by warmly greeting the candidate and asking them to 'Tell me about yourself'. "
            "Then proceed with questions derived from their resume and answers. "
            "Do NOT repeat questions. Keep each question concise (1-3 sentences max). "
            "Do NOT provide answers or hints. Be professional and strict."
        )

    def get_response(
        self,
        history: list,
        user_text: str,
        resume_context: str = "",
        time_warning: bool = False,
        is_last: bool = False,
    ) -> str:
        if not self.enabled:
            fallback = [
                "Can you walk me through a challenging project you've worked on?",
                "How do you approach debugging complex issues?",
                "Describe your experience with the technologies listed on your resume.",
                "What is your greatest professional achievement so far?",
                "Where do you see yourself in 5 years?",
            ]
            return fallback[hash(user_text) % len(fallback)]

        messages = list(history)
        if resume_context:
            messages.insert(
                1,
                {
                    "role": "system",
                    "content": f"[RESUME CONTEXT — use this to ask informed questions]: {resume_context}",
                },
            )

        if time_warning:
            messages.append(
                {
                    "role": "system",
                    "content": "⚠️ IMPORTANT: Only 1 minute remaining in the interview. Tell the candidate this is their LAST question, ask them to answer quickly, and wrap up professionally.",
                }
            )
        elif is_last:
            messages.append(
                {
                    "role": "system",
                    "content": "This is the final question. After the candidate answers this, you should conclude the interview.",
                }
            )

        messages.append({"role": "user", "content": user_text})

        try:
            completion = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                max_tokens=300,
                temperature=0.7,
            )
            return completion.choices[0].message.content
        except Exception as e:
            print(f"GROQ Error: {e}")
            return "Thank you for your response. Let's continue — can you tell me about a time you had to learn something new quickly?"

    def text_to_audio(self, text: str) -> str:
        """Convert text to MP3 and save to static/audio/. Returns relative path."""
        audio_id = f"{uuid.uuid4()}.mp3"
        audio_path = os.path.join("static", "audio", audio_id)
        os.makedirs(os.path.dirname(audio_path), exist_ok=True)
        try:
            tts = gTTS(text=text, lang="en", slow=False)
            tts.save(audio_path)
        except Exception as e:
            print(f"TTS Error: {e}")
        return f"static/audio/{audio_id}"


interviewer = InterviewerAgent()
