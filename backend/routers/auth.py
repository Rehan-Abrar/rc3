from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

import models as m
import serializers as S
import schemas
from db import get_db
from security import create_token, current_user, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201)
def register(body: schemas.RegisterIn, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(m.User).where(m.User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    u = m.User(email=email, password_hash=hash_password(body.password),
               full_name=body.full_name.strip(), role=body.role)
    db.add(u)
    db.commit()
    db.refresh(u)
    return S.auth(create_token(u), u)


@router.post("/login")
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    u = db.scalar(select(m.User).where(m.User.email == body.email.lower()))
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    return S.auth(create_token(u), u)


@router.get("/me")
def me(u: m.User = Depends(current_user)):
    return S.user(u)


@router.post("/logout")
def logout(u: m.User = Depends(current_user)):
    # Tokens are stateless; the client drops it. Logged for the audit trail.
    return {"detail": f"Signed out {u.email}"}
