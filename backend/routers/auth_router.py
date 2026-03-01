from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
import sqlite3
from core.database import get_db
from core.auth import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    education: str = ""


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


@router.post("/register")
def register(req: RegisterRequest, db: sqlite3.Connection = Depends(get_db)):
    existing = db.execute(
        "SELECT id FROM users WHERE email = ?", (req.email,)
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(req.password)
    db.execute(
        "INSERT INTO users (name, email, password_hash, education) VALUES (?, ?, ?, ?)",
        (req.name, req.email, hashed, req.education),
    )
    db.commit()
    return {"message": "Registration successful", "email": req.email}


@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: sqlite3.Connection = Depends(get_db),
):
    user = db.execute(
        "SELECT * FROM users WHERE email = ?", (form_data.username,)
    ).fetchone()
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(user["id"])})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "education": user["education"],
        },
    }


@router.post("/login-json")
def login_json(req: dict, db: sqlite3.Connection = Depends(get_db)):
    """JSON body login for frontend convenience."""
    user = db.execute(
        "SELECT * FROM users WHERE email = ?", (req.get("email"),)
    ).fetchone()
    if not user or not verify_password(req.get("password", ""), user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(user["id"])})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "education": user["education"],
        },
    }
