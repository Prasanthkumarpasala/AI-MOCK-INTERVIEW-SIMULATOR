import os
from pathlib import Path
from dotenv import load_dotenv

# 1. This finds the folder where this config.py is located
current_file_path = Path(__file__).resolve()

# 2. This goes up one level to the 'backend' folder
backend_dir = current_file_path.parent.parent

# 3. This points exactly to the .env file in the backend folder
env_path = backend_dir / ".env"

# 4. Load the file using the exact path
load_dotenv(dotenv_path=env_path)

class Settings:
    PROJECT_NAME: str = "AI Mock Interview Simulator"
    # We use os.getenv to read the key after loading the file above
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY")

settings = Settings()

# --- Debugging Print ---
# This will show in your terminal so we can see if it worked
if hasattr(settings, "GROQ_API_KEY") and settings.GROQ_API_KEY:
    print("✅ Success: Groq API Key loaded from .env")
else:
    print(f"❌ Error: Groq API Key NOT FOUND at: {env_path}")