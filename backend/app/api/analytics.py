from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import select,func,case,cast,String
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Customer, Booking, Ticket, QualityLog, SyncLog
from ..security import current_user
from ..services import booking_rows

router=APIRouter(prefix='/api/analytics',tags=['SQL analytics'])

def dashboard_data(db,start=None,end=None):
    filters=[]
    if start:
        filters.append(Booking.booking_date>=start)
    if end:
        filters.append(Booking.booking_date<=end)
    revenue=case((Booking.status=='confirmed',Booking.total),else_=0)
    tickets=case((Booking.status=='confirmed',Booking.quantity),else_=0)
    aggregate=db.execute(select(func.count(Booking.id),func.coalesce(func.sum(revenue),0),func.coalesce(func.sum(tickets),0),func.coalesce(func.avg(case((Booking.status=='confirmed',Booking.total))),0)).where(*filters)).one()
    daily=[{'date':str(d),'bookings':n,'revenue':float(r)} for d,n,r in db.execute(select(Booking.booking_date,func.count(),func.sum(revenue)).where(*filters).group_by(Booking.booking_date).order_by(Booking.booking_date))]
    month=func.substr(cast(Booking.booking_date,String),1,7)
    monthly=[{'month':m,'revenue':float(r)} for m,r in db.execute(select(month,func.sum(revenue)).where(*filters).group_by(month).order_by(month))]
    categories=[{'name':n,'tickets':int(q),'revenue':float(r)} for n,q,r in db.execute(select(Ticket.name,func.sum(tickets),func.sum(revenue)).join(Booking).where(*filters).group_by(Ticket.name))]
    statuses=[{'name':s,'value':n} for s,n in db.execute(select(Booking.status,func.count()).where(*filters).group_by(Booking.status))]
    latest=db.scalar(select(SyncLog).where(SyncLog.status=='success').order_by(SyncLog.id.desc()).limit(1))
    reports=db.scalars(select(QualityLog).where(QualityLog.applied==False).order_by(QualityLog.id.desc()).limit(20)).all()
    activity=[{'name':n,'bookings':c} for n,c in db.execute(select(Customer.name,func.count(Booking.id)).join(Booking).where(*filters).group_by(Customer.id,Customer.name).order_by(func.count(Booking.id).desc()).limit(6))]
    return {'total_customers':db.scalar(select(func.count(Customer.id))),'total_bookings':aggregate[0],'revenue':float(aggregate[1]),'tickets_sold':int(aggregate[2]),'average_booking':float(aggregate[3]),'pending':next((r['value'] for r in statuses if r['name']=='pending'),0),'cancelled':next((r['value'] for r in statuses if r['name']=='cancelled'),0),'quality_issues':sum(r.report['validation_errors'] for r in reports),'last_sync':latest.created_at if latest else None,'daily':daily,'monthly':monthly,'categories':categories,'statuses':statuses,'customer_activity':activity,'recent':sorted(booking_rows(db,start,end),key=lambda r:r['id'],reverse=True)[:6],'alerts':[{'id':r.id,'source':r.source,'errors':r.report['validation_errors']} for r in reports if r.report['invalid']][:5]}

@router.get('/dashboard')
def dashboard(start:date|None=None,end:date|None=None,user=Depends(current_user),db:Session=Depends(get_db)):
    return dashboard_data(db,start,end)

@router.get('/revenue')
def revenue(start:date|None=None,end:date|None=None,user=Depends(current_user),db:Session=Depends(get_db)):
    return dashboard_data(db,start,end)['monthly']

@router.get('/bookings')
def bookings(start:date|None=None,end:date|None=None,user=Depends(current_user),db:Session=Depends(get_db)):
    return dashboard_data(db,start,end)['daily']
