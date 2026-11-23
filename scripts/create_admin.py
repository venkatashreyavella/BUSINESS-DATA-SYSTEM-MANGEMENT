"""Interactive administrator bootstrap. Password never enters shell history."""
import sys,getpass
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from sqlalchemy import select
from app.database import SessionLocal
from app.models import User
from app.schemas import Registration
from app.security import passwords
email=input('Administrator email: ').strip().lower()
name=input('Full name: ').strip()
password=getpass.getpass('Password (12+ characters): ')
if password!=getpass.getpass('Confirm password: '):
    raise SystemExit('Passwords did not match')
body=Registration(email=email,name=name,password=password)
with SessionLocal() as db:
    if db.scalar(select(User).where(User.email==body.email)):
        raise SystemExit('Email already registered. Use a new administrator email.')
    db.add(User(email=body.email,name=body.name,password_hash=passwords.hash(body.password),role='administrator'))
    db.commit()
print('Administrator created.')
