import os, secrets, hashlib, time, threading
from datetime import timedelta, timezone
from fastapi import Depends, HTTPException, Request, Response
from pwdlib import PasswordHash
from sqlalchemy.orm import Session as DBSession
from .database import get_db
from .models import User, Session, now

passwords = PasswordHash.recommended()
secure = os.getenv('COOKIE_SECURE', 'false').lower() == 'true'
production = os.getenv('ENVIRONMENT') == 'production'
if production and (not secure or len(os.getenv('SECRET_KEY', '')) < 32):
    raise RuntimeError('Production requires COOKIE_SECURE=true and a random SECRET_KEY of at least 32 characters')

def digest(raw):
    return hashlib.sha256((os.getenv('SECRET_KEY', 'local-development') + raw).encode()).hexdigest()

def current_user(request: Request, db: DBSession = Depends(get_db)):
    raw = request.cookies.get('museum_session', '')
    session = db.get(Session, digest(raw))
    expiry = session.expires.replace(tzinfo=timezone.utc) if session and session.expires.tzinfo is None else (session.expires if session else now())
    if not session or expiry <= now():
        raise HTTPException(401, 'Please sign in')
    user = db.get(User, session.user_id)
    if not user or not user.active:
        raise HTTPException(401, 'Account unavailable')
    return user

def admin(user=Depends(current_user)):
    if user.role != 'administrator' or user.demo:
        raise HTTPException(403, 'Administrator access required')
    return user

def start_session(response: Response, db, user):
    raw = secrets.token_urlsafe(48)
    db.add(Session(id=digest(raw), user_id=user.id, expires=now() + timedelta(hours=8)))
    db.commit()
    response.set_cookie('museum_session', raw, httponly=True, secure=secure, samesite='none' if secure else 'lax', max_age=28800, path='/')
    csrf = secrets.token_urlsafe(32)
    response.set_cookie('museum_csrf', csrf, secure=secure, samesite='none' if secure else 'lax', max_age=28800, path='/')
    return {'id': user.id, 'email': user.email, 'name': user.name, 'role': user.role, 'demo': user.demo, 'csrf': csrf}

attempts = {}
rate_lock = threading.Lock()
def rate_limit(request: Request):
    key = request.client.host if request.client else 'unknown'
    stamp = time.monotonic()
    with rate_lock:
        for stale in [k for k,v in attempts.items() if not v or stamp-v[-1]>60]:
            attempts.pop(stale, None)
        hits = [t for t in attempts.get(key, []) if stamp-t < 60]
        if len(hits) >= 15:
            raise HTTPException(429, 'Too many attempts; retry in one minute')
        attempts[key] = hits + [stamp]
