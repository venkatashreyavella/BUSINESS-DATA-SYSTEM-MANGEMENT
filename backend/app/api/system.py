import os, uuid, time
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select,text,func
from sqlalchemy.orm import Session
from ..database import get_db, SessionLocal
from ..models import IntegrationLog, SyncLog, AuditLog, Customer, Ticket, Booking, JobRun
from ..schemas import BookingInput
from ..security import current_user
from ..services import serialize, sync_bigquery, audit
from .records import save_booking

router=APIRouter(prefix='/api',tags=['Integrations and system'])

@router.get('/integrations/status')
def status(user=Depends(current_user),db:Session=Depends(get_db)):
    logs=db.scalars(select(IntegrationLog).where(IntegrationLog.integration=='Ticketing sandbox (simulation)').order_by(IntegrationLog.id.desc())).all()
    success=[r for r in logs if r.status=='success']
    failed=[r for r in logs if r.status=='failed']
    return [{'name':'Ticketing sandbox','mode':'Simulation','status':'available','successes':len(success),'failures':len(failed),'last_success':success[0].created_at if success else None,'last_failure':failed[0].created_at if failed else None},{'name':'Google BigQuery','mode':'Live provider' if os.getenv('BIGQUERY_PROJECT') else 'Not configured','status':'configured_unverified' if os.getenv('BIGQUERY_PROJECT') else 'not_configured','successes':db.scalar(select(func.count(SyncLog.id)).where(SyncLog.status=='success')),'failures':db.scalar(select(func.count(SyncLog.id)).where(SyncLog.status=='failed'))}]

@router.get('/integrations/logs')
def logs(user=Depends(current_user),db:Session=Depends(get_db)):
    return [serialize(r) for r in db.scalars(select(IntegrationLog).order_by(IntegrationLog.id.desc()).limit(100))]

@router.get('/integrations/bigquery')
def warehouse(user=Depends(current_user),db:Session=Depends(get_db)):
    history=[serialize(r) for r in db.scalars(select(SyncLog).order_by(SyncLog.id.desc()).limit(50))]
    return {'project':os.getenv('BIGQUERY_PROJECT') or None,'dataset':os.getenv('BIGQUERY_DATASET','museum_analytics'),'table':'bookings','status':'configured_unverified' if os.getenv('BIGQUERY_PROJECT') else 'not_configured','history':history,'last_success':next((h for h in history if h['status']=='success'),None)}

def run_sync():
    with SessionLocal() as db:
        sync_bigquery(db)

@router.post('/integrations/bigquery/sync',status_code=202)
def sync(tasks:BackgroundTasks,user=Depends(current_user),db:Session=Depends(get_db)):
    if not os.getenv('BIGQUERY_PROJECT'):
        result=sync_bigquery(db)
        raise HTTPException(503,result['message'])
    audit(db,user,'Requested BigQuery snapshot synchronisation')
    db.commit()
    tasks.add_task(run_sync)
    return {'message':'Synchronisation queued. Refresh history to see the verified outcome.'}

@router.post('/integrations/ticketing/webhook',status_code=201)
def webhook(body:BookingInput,event_id:str,user=Depends(current_user),db:Session=Depends(get_db)):
    if not event_id or len(event_id)>100:
        raise HTTPException(422,'Event ID must contain 1–100 characters')
    existing=db.scalar(select(Booking).where(Booking.external_id==event_id))
    if existing:
        return {'booking_id':existing.id,'duplicate_event':True}
    try:
        b=save_booking(db,body,user)
        b.external_id=event_id
        db.add(IntegrationLog(integration='Ticketing sandbox (simulation)',status='success',message=f'Accepted event {event_id}; booking {b.id}'))
        db.commit()
        return {'booking_id':b.id,'duplicate_event':False}
    except HTTPException as exc:
        db.rollback()
        db.add(IntegrationLog(integration='Ticketing sandbox (simulation)',status='failed',message=str(exc.detail)))
        db.commit()
        raise

@router.post('/integrations/ticketing/simulate')
def simulate(user=Depends(current_user),db:Session=Depends(get_db)):
    c=db.scalar(select(Customer).where(Customer.status=='active').limit(1))
    t=db.scalar(select(Ticket).where(Ticket.active==True).limit(1))
    if not c or not t:
        raise HTTPException(409,'Create an active customer and ticket first')
    body=BookingInput(customer_id=c.id,ticket_id=t.id,visit_date=date.today(),quantity=1)
    return webhook(body,'simulation-'+uuid.uuid4().hex,user,db)

@router.get('/system/status')
def system(user=Depends(current_user),db:Session=Depends(get_db)):
    started=time.monotonic()
    db.execute(text('SELECT 1'))
    return {'database':'healthy','database_engine':db.bind.dialect.name,'response_ms':round((time.monotonic()-started)*1000,2),'bigquery':'configured_unverified' if os.getenv('BIGQUERY_PROJECT') else 'not_configured','scheduler_enabled':os.getenv('SCHEDULER_ENABLED')=='true'}

@router.get('/activity')
def activity(user=Depends(current_user),db:Session=Depends(get_db)):
    return [serialize(r) for r in db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(200))]

@router.get('/system/jobs')
def jobs(user=Depends(current_user),db:Session=Depends(get_db)):
    return [serialize(r) for r in db.scalars(select(JobRun).order_by(JobRun.id.desc()).limit(50))]
