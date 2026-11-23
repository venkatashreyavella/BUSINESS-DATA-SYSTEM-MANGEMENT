import os
from datetime import date
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from .database import SessionLocal
from .models import JobRun, IntegrationLog, now
from .services import validate_database, sync_bigquery

def daily_job():
    """Unique database claim prevents duplicate daily runs across workers/restarts.
    Failed/interrupted claims require operator review, never an automatic repeat.
    """
    with SessionLocal() as db:
        claim=JobRun(name='daily-processing',day=date.today(),status='running')
        db.add(claim)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return
        try:
            db.execute(text('SELECT 1'))
            db.add(IntegrationLog(integration='Daily system monitor',status='success',message='Database query succeeded; starting validation and configured warehouse checks'))
            db.commit()
            validate_database(db)
            result=sync_bigquery(db) if os.getenv('BIGQUERY_PROJECT') else None
            claim.status='failed' if result and result['status']=='failed' else 'success'
        except Exception:
            db.rollback()
            claim=db.get(JobRun,claim.id)
            claim.status='failed'
        claim.completed_at=now()
        db.commit()
