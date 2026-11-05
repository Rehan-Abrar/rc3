from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from config import JWT_ALG, JWT_SECRET, JWT_TTL_MIN
from db import get_db
from models import User

_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))
    except ValueError:
        return False


def create_token(user: User) -> str:
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "email": user.email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_TTL_MIN),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Bearer header, or a ?token= query parameter for plain browser links (file views)."""
    raw = creds.credentials if creds and creds.credentials else (token or "")
    if not raw:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = jwt.decode(raw, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expired, log in again")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.get(User, int(payload.get("sub", 0)))
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User no longer exists")
    return user


def require_role(role: str):
    def guard(user: User = Depends(current_user)) -> User:
        if user.role != role:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires {role} role")
        return user

    return guard


require_recruiter = require_role("recruiter")
require_candidate = require_role("candidate")
