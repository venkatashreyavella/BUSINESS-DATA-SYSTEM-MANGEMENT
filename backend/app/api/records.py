from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Customer, Booking, Ticket, Waiver, now
from ..schemas import CustomerInput, BookingInput, TicketInput
from ..security import current_user, admin
from ..services import serialize, booking_rows, audit

router=APIRouter(prefix='/api',tags=['Business records'])

@router.get('/customers')
def customers(q:str='',status:str='',page:int=Query(1,ge=1),size:int=Query(20,ge=1,le=200),user=Depends(current_user),db:Session=Depends(get_db)):
    stmt=select(Customer)
    if q:
        stmt=stmt.where(or_(Customer.name.ilike(f'%{q}%'),Customer.email.ilike(f'%{q}%')))
    if status:
        stmt=stmt.where(Customer.status==status)
    total=db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows=db.scalars(stmt.order_by(Customer.id.desc()).offset((page-1)*size).limit(size)).all()
    counts=dict(db.execute(select(Booking.customer_id,func.count()).group_by(Booking.customer_id)).all())
    return {'items':[{**serialize(c),'total_bookings':counts.get(c.id,0)} for c in rows],'total':total,'page':page,'size':size}

@router.get('/customers/{customer_id}')
def customer(customer_id:int,user=Depends(current_user),db:Session=Depends(get_db)):
    c=db.get(Customer,customer_id)
    if not c:
        raise HTTPException(404,'Customer not found')
    return {**serialize(c),'bookings':[r for r in booking_rows(db) if r['customer_id']==c.id]}

@router.post('/customers',status_code=201)
def create_customer(body:CustomerInput,user=Depends(current_user),db:Session=Depends(get_db)):
    if db.scalar(select(Customer.id).where(Customer.email==body.email)):
        raise HTTPException(409,'A customer with this email already exists')
    c=Customer(**body.model_dump())
    db.add(c)
    db.flush()
    audit(db,user,'Created customer',id=c.id)
    db.commit()
    return serialize(c)

@router.put('/customers/{customer_id}')
def update_customer(customer_id:int,body:CustomerInput,user=Depends(current_user),db:Session=Depends(get_db)):
    c=db.get(Customer,customer_id)
    if not c:
        raise HTTPException(404,'Customer not found')
    if db.scalar(select(Customer.id).where(Customer.email==body.email,Customer.id!=customer_id)):
        raise HTTPException(409,'Email already exists')
    for k,v in body.model_dump().items():
        setattr(c,k,v)
    audit(db,user,'Updated customer',id=c.id)
    db.commit()
    return serialize(c)

@router.delete('/customers/{customer_id}')
def delete_customer(customer_id:int,user=Depends(current_user),db:Session=Depends(get_db)):
    c=db.get(Customer,customer_id)
    if not c:
        raise HTTPException(404,'Customer not found')
    if db.scalar(select(Booking.id).where(Booking.customer_id==customer_id).limit(1)):
        raise HTTPException(409,'Customer has bookings; set their status to inactive instead')
    db.delete(c)
    audit(db,user,'Deleted customer',id=customer_id)
    db.commit()
    return {'message':'Customer deleted'}

@router.get('/bookings')
def bookings(q:str='',status:str='',start:date|None=None,end:date|None=None,visit:date|None=None,page:int=Query(1,ge=1),size:int=Query(20,ge=1,le=200),user=Depends(current_user),db:Session=Depends(get_db)):
    rows=booking_rows(db,start,end)
    rows=[r for r in rows if (not q or q.lower() in str(r['id']) or q.lower() in r['customer_name'].lower()) and (not status or r['status']==status) and (not visit or r['visit_date']==visit)]
    rows.sort(key=lambda r:r['id'],reverse=True)
    return {'items':rows[(page-1)*size:page*size],'total':len(rows),'page':page,'size':size}

@router.get('/bookings/{booking_id}')
def booking(booking_id:int,user=Depends(current_user),db:Session=Depends(get_db)):
    result=next((r for r in booking_rows(db) if r['id']==booking_id),None)
    if not result:
        raise HTTPException(404,'Booking not found')
    return result

def save_booking(db,body,user,b=None):
    customer=db.get(Customer,body.customer_id)
    ticket=db.get(Ticket,body.ticket_id)
    if not customer or customer.status!='active' or not ticket or not ticket.active:
        raise HTTPException(422,'Choose an active customer and ticket product')
    data=body.model_dump(exclude={'waiver_signed'})
    price=b.price if b and b.ticket_id==ticket.id else ticket.price
    if b:
        for k,v in data.items():
            setattr(b,k,v)
    else:
        b=Booking(**data,price=price,total=Decimal(str(price))*body.quantity)
        db.add(b)
        db.flush()
    b.price=price
    b.total=Decimal(str(price))*body.quantity
    waiver=db.scalar(select(Waiver).where(Waiver.booking_id==b.id))
    if not waiver:
        waiver=Waiver(booking_id=b.id)
        db.add(waiver)
    waiver.signed=body.waiver_signed
    waiver.signed_at=now() if body.waiver_signed else None
    audit(db,user,'Saved booking',id=b.id,status=b.status)
    return b

@router.post('/bookings',status_code=201)
def create_booking(body:BookingInput,user=Depends(current_user),db:Session=Depends(get_db)):
    b=save_booking(db,body,user)
    db.commit()
    return serialize(b)

@router.put('/bookings/{booking_id}')
def update_booking(booking_id:int,body:BookingInput,user=Depends(current_user),db:Session=Depends(get_db)):
    b=db.get(Booking,booking_id)
    if not b:
        raise HTTPException(404,'Booking not found')
    b=save_booking(db,body,user,b)
    db.commit()
    return serialize(b)

@router.delete('/bookings/{booking_id}')
def cancel_booking(booking_id:int,user=Depends(current_user),db:Session=Depends(get_db)):
    b=db.get(Booking,booking_id)
    if not b:
        raise HTTPException(404,'Booking not found')
    b.status='cancelled'
    audit(db,user,'Cancelled booking',id=b.id)
    db.commit()
    return {'message':'Booking cancelled; historical record retained'}

@router.get('/tickets')
def tickets(user=Depends(current_user),db:Session=Depends(get_db)):
    return [serialize(t) for t in db.scalars(select(Ticket).order_by(Ticket.id))]

@router.post('/tickets',status_code=201)
def create_ticket(body:TicketInput,user=Depends(admin),db:Session=Depends(get_db)):
    t=Ticket(**body.model_dump())
    db.add(t)
    audit(db,user,'Created ticket product',name=body.name)
    db.commit()
    return serialize(t)

@router.put('/tickets/{ticket_id}')
def update_ticket(ticket_id:int,body:TicketInput,user=Depends(admin),db:Session=Depends(get_db)):
    t=db.get(Ticket,ticket_id)
    if not t:
        raise HTTPException(404,'Ticket not found')
    for k,v in body.model_dump().items():
        setattr(t,k,v)
    audit(db,user,'Updated ticket product',id=t.id)
    db.commit()
    return serialize(t)
