import os
import uuid
from gtts import gTTS

class InterviewerAgent:
    def __init__(self):
        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        # Only enable if valid GROQ key (starts with gsk_)
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
        self.history = [{"role": "system", "content": "You are a professional technical interviewer. Ask one concise question at a time."}]

    def get_response_and_audio(self, user_text):
        if not self.enabled:
            # Mock responses when GROQ API key not configured
            mock_questions = [
                "That's great! Tell me about your most challenging project you've worked on.",
                "How do you approach problem-solving in your development process?",
                "What technologies are you most comfortable with and why?",
                "Describe a time you had to debug a difficult issue.",
                "What are your career goals and how do you plan to achieve them?"
            ]
            ai_text = mock_questions[hash(user_text) % len(mock_questions)]
            
            audio_id = f"{uuid.uuid4()}.mp3"
            audio_path = os.path.join("static", "audio", audio_id)
            os.makedirs(os.path.dirname(audio_path), exist_ok=True)
            try:
                tts = gTTS(text=ai_text, lang='en')
                tts.save(audio_path)
            except:
                pass
            self.history.append({"role": "assistant", "content": ai_text})
            return ai_text, f"static/audio/{audio_id}"
        
        self.history.append({"role": "user", "content": user_text})
        try:
            completion = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=self.history
            )
            ai_text = completion.choices[0].message.content
            self.history.append({"role": "assistant", "content": ai_text})
        except Exception as e:
            ai_text = "I appreciate your response. Can you expand on that?"
            print(f"GROQ Error: {e}")
            self.history.append({"role": "assistant", "content": ai_text})

        # Save to static/audio folder
        audio_id = f"{uuid.uuid4()}.mp3"
        audio_path = os.path.join("static", "audio", audio_id)
        os.makedirs(os.path.dirname(audio_path), exist_ok=True)
        
        try:
            tts = gTTS(text=ai_text, lang='en')
            tts.save(audio_path)
        except:
            pass
        
        return ai_text, f"static/audio/{audio_id}"