import os
from pathlib import Path
from dotenv import load_dotenv

current_file_path = Path(__file__).resolve()
backend_dir = current_file_path.parent.parent
env_path = backend_dir / ".env"
load_dotenv(dotenv_path=env_path)


class Settings:
    PROJECT_NAME: str = "AI Mock Interview Simulator"
    VERSION: str = "2.0.0"
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY", "super-secret-key-change-in-production-32chars"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    BASE_URL: str = os.getenv("BASE_URL", "http://localhost:8000")
    DB_PATH: str = str(backend_dir / "interview_sim.db")
    CHROMA_PATH: str = str(backend_dir / "chroma_db")


settings = Settings()

if settings.GROQ_API_KEY and settings.GROQ_API_KEY.startswith("gsk_"):
    print("✅ Groq API Key loaded")
else:
    print(f"❌ Groq API Key NOT FOUND at: {env_path}")
