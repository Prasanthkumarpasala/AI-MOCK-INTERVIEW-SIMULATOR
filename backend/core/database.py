import sqlite3
import asyncio
from core.config import settings

CREATE_USERS = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    education TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
"""

CREATE_INTERVIEWS = """
CREATE TABLE IF NOT EXISTS interviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    status TEXT DEFAULT 'setup',
    interview_type TEXT DEFAULT 'mixed',
    skills TEXT DEFAULT '',
    duration_minutes INTEGER DEFAULT 10,
    round INTEGER DEFAULT 0,
    warning_count INTEGER DEFAULT 0,
    termination_reason TEXT DEFAULT '',
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
"""

CREATE_MESSAGES = """
CREATE TABLE IF NOT EXISTS interview_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(interview_id) REFERENCES interviews(id)
);
"""

CREATE_REPORTS = """
CREATE TABLE IF NOT EXISTS interview_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    interview_id INTEGER NOT NULL UNIQUE,
    overall_score REAL DEFAULT 0,
    technical_score REAL DEFAULT 0,
    communication_score REAL DEFAULT 0,
    hr_score REAL DEFAULT 0,
    strengths TEXT DEFAULT '[]',
    improvements TEXT DEFAULT '[]',
    summary TEXT DEFAULT '',
    learning_path TEXT DEFAULT '[]',
    pdf_path TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(interview_id) REFERENCES interviews(id)
);
"""


def init_db():
    conn = sqlite3.connect(settings.DB_PATH)
    c = conn.cursor()
    c.execute(CREATE_USERS)
    c.execute(CREATE_INTERVIEWS)
    c.execute(CREATE_MESSAGES)
    c.execute(CREATE_REPORTS)
    conn.commit()
    conn.close()
    print(f"✅ Database initialized at {settings.DB_PATH}")


def get_db():
    conn = sqlite3.connect(settings.DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
