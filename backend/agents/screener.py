import PyPDF2
from groq import Groq
import os
from dotenv import load_dotenv
load_dotenv()

class ScreenerAgent:
    def __init__(self):
        api_key = os.environ.get("GROQ_API_KEY", "").strip()
        if api_key and api_key.startswith("gsk_"):
            try:
                self.client = Groq(api_key=api_key)
                self.enabled = True
            except Exception as e:
                print(f"GROQ API Error: {e}")
                self.enabled = False
        else:
            self.enabled = False

    def extract_text_from_pdf(self, file_path):
        text = ""
        try:
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text += page.extract_text()
        except:
            text = "Sample resume text"
        return text

    def analyze_resume(self, text):
        if not self.enabled:
            return "Mock analysis: Top skills - Python, JavaScript, Cloud Architecture"
        
        prompt = f"Analyze this resume and summarize the candidate's top 3 technical skills and project experience: {text}"
        try:
            chat_completion = self.client.chat.completions.create(
                messages=[{"role": "user", "content": prompt}],
                model="llama-3.1-8b-instant",
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            return f"Mock analysis: Top skills - Python, JavaScript, Cloud Architecture"