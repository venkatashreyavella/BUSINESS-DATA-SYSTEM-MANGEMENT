import json, os, random
from datetime import date, timedelta
from decimal import Decimal
from sqlalchemy import select, func
from .models import Customer, Booking, Ticket, Waiver, User, AuditLog, QualityLog, SyncLog, now
from .security import passwords
from .quality import validate_records

def audit(db, user, action, **details):
    db.add(AuditLog(user_id=user.id if user else None, action=action, details=details))

def serialize(obj):
    return {c.name: (float(v) if isinstance(v := getattr(obj, c.name), Decimal) else v) for c in obj.__table__.columns}

def booking_rows(db, start=None, end=None):
    stmt = select(Booking, Customer.name, Ticket.name, Waiver.signed).join(Customer).join(Ticket).outerjoin(Waiver)
    if start:
        stmt = stmt.where(Booking.booking_date >= start)
    if end:
        stmt = stmt.where(Booking.booking_date <= end)
    return [{**serialize(b), 'customer_name': c, 'ticket_name': t, 'waiver_signed': bool(w)} for b,c,t,w in db.execute(stmt).all()]

def quality_report(db, records, kind, check_existing=True):
    model = Customer if kind == 'customers' else Booking
    ids = set(map(str, db.scalars(select(model.id)).all())) if check_existing else set()
    emails = set(db.scalars(select(Customer.email)).all()) if check_existing and kind == 'customers' else set()
    return validate_records(records, kind, set(db.scalars(select(Customer.id))), ids, emails, set(db.scalars(select(Ticket.id))))

def validate_database(db):
    results = []
    for kind, records in [('customers',[serialize(c) for c in db.scalars(select(Customer))]), ('bookings',booking_rows(db))]:
        records = json.loads(json.dumps(records, default=str))
        report = quality_report(db, records, kind, False)
        log = QualityLog(kind=kind, source='Database validation', original=records, report=report)
        db.add(log)
        results.append(report)
    db.commit()
    return results

def seed(db):
    if db.scalar(select(func.count(Customer.id))):
        return
    rng = random.Random(42)
    demo = User(email='demo@museum.example', name='Portfolio reviewer', password_hash=passwords.hash('MuseumDemo2026!'), role='staff', demo=True)
    db.add(demo)
    tickets = [Ticket(name=n, price=p) for n,p in [('General admission', 95),('Family experience', 240),('Student discovery', 60),('Immersive experience', 150)]]
    db.add_all(tickets)
    first = ['Amira','Oliver','Layla','Noah','Maya','Ethan','Zara','Leo','Sofia','Adam','Nora','Daniel']
    last = ['Morgan','Patel','Chen','Hassan','Reed','Ali','Khan','Silva','Park','Brooks']
    for i in range(120):
        db.add(Customer(name=f'{first[i % 12]} {last[i // 12]}', email=f'visitor{i+1:03}@example.com', phone=f'+97150000{i:04}', registered_at=now()-timedelta(days=rng.randint(40,240))))
    db.flush()
    ids = list(db.scalars(select(Customer.id)))
    for i in range(260):
        ticket = tickets[i % 4]
        booked = date.today()-timedelta(days=rng.randint(0,179))
        quantity = rng.randint(1,5)
        b = Booking(customer_id=rng.choice(ids), ticket_id=ticket.id, booking_date=booked, visit_date=booked+timedelta(days=rng.randint(1,30)), quantity=quantity, price=ticket.price, total=Decimal(str(ticket.price))*quantity, status=rng.choices(['confirmed','pending','cancelled'],[80,14,6])[0])
        db.add(b)
        db.flush()
        signed = rng.random() > .2
        db.add(Waiver(booking_id=b.id,signed=signed,signed_at=now() if signed else None))
    audit(db,None,'Loaded reproducible fictional demo dataset', customers=120,bookings=260)
    db.commit()

def sync_bigquery(db):
    project = os.getenv('BIGQUERY_PROJECT')
    dataset = os.getenv('BIGQUERY_DATASET','museum_analytics')
    if not project:
        log = SyncLog(status='not_configured',records=0,message='BigQuery project and credentials are not configured. PostgreSQL remains the source of truth.')
    else:
        try:
            from google.cloud import bigquery
            from google.oauth2 import service_account
            credentials = None
            if os.getenv('GOOGLE_SERVICE_ACCOUNT_JSON'):
                credentials = service_account.Credentials.from_service_account_info(json.loads(os.environ['GOOGLE_SERVICE_ACCOUNT_JSON']))
            client = bigquery.Client(project=project,credentials=credentials)
            rows = booking_rows(db)
            records = json.loads(json.dumps(rows,default=str))
            report = quality_report(db,records,'bookings',False)
            if report['invalid']:
                raise ValueError('Resolve invalid database records before warehouse loading')
            client.create_dataset(bigquery.Dataset(f'{project}.{dataset}'), exists_ok=True)
            schema = [bigquery.SchemaField(n,t) for n,t in [('id','INTEGER'),('customer_id','INTEGER'),('ticket_id','INTEGER'),('booking_date','DATE'),('visit_date','DATE'),('quantity','INTEGER'),('price','NUMERIC'),('total','NUMERIC'),('status','STRING'),('external_id','STRING'),('customer_name','STRING'),('ticket_name','STRING'),('waiver_signed','BOOLEAN')]]
            table = f'{project}.{dataset}.bookings'
            client.create_table(bigquery.Table(table,schema=schema),exists_ok=True)
            job = client.load_table_from_json(records,table,job_config=bigquery.LoadJobConfig(schema=schema,write_disposition='WRITE_TRUNCATE'))
            job.result(timeout=180)
            log = SyncLog(status='success',records=len(records),message=f'Completed BigQuery load job {job.job_id}')
        except Exception as exc:
            # Detailed provider exceptions may contain sensitive connection data.
            log = SyncLog(status='failed',records=0,message=f'BigQuery load failed ({type(exc).__name__}); check server credentials, dataset permissions and provider logs.')
    db.add(log)
    db.commit()
    return serialize(log)
