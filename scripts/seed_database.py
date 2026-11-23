import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from app.database import SessionLocal
from app.services import seed
with SessionLocal() as db:
    seed(db)
print('Demo seed completed (existing populated databases are unchanged).')
