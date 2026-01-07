import os
import uuid
from groq import Groq
from gtts import gTTS

class InterviewerAgent:
    def __init__(self):
        self.client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        self.history = [{"role": "system", "content": "You are a professional technical interviewer. Ask one concise question at a time."}]

    def get_response_and_audio(self, user_text):
        self.history.append({"role": "user", "content": user_text})
        completion = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=self.history
        )
        ai_text = completion.choices[0].message.content
        self.history.append({"role": "assistant", "content": ai_text})

        # Save to your static/audio folder
        audio_id = f"{uuid.uuid4()}.mp3"
        audio_path = os.path.join("static", "audio", audio_id)
        
        tts = gTTS(text=ai_text, lang='en')
        tts.save(audio_path)
        
        return ai_text, f"static/audio/{audio_id}"