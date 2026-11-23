from unittest.mock import patch
from datetime import date
from app.quality import validate_records
from app.services import sync_bigquery
from app.models import SyncLog,Session as LoginSession
from app.database import get_db
from app.main import app

CUSTOMER={'name':'Maya Reed','email':'maya@example.com','phone':'+971500000001','status':'active'}
BOOKING={'customer_id':1,'ticket_id':1,'quantity':3,'visit_date':'2026-12-01','status':'confirmed','waiver_signed':True}

def test_auth_protection_logout_and_csrf(client):
    assert client.get('/api/customers').status_code==401
    assert client.post('/api/auth/login',json={'email':'staff@example.com','password':'wrong'}).status_code==401
    result=client.post('/api/auth/login',json={'email':'staff@example.com','password':'TestPassword2026!'})
    assert 'HttpOnly' in result.headers['set-cookie']
    assert client.post('/api/customers',json=CUSTOMER).status_code==403
    client.headers['X-CSRF-Token']=result.json()['csrf']
    assert client.get('/api/auth/me').json()['role']=='staff'
    assert client.post('/api/auth/logout').status_code==200
    assert client.get('/api/customers').status_code==401

def test_customer_create_update_search_duplicate_and_delete(signed):
    c=signed.post('/api/customers',json=CUSTOMER)
    assert c.status_code==201,c.text
    cid=c.json()['id']
    assert signed.post('/api/customers',json=CUSTOMER).status_code==409
    assert signed.put(f'/api/customers/{cid}',json={**CUSTOMER,'name':'Maya Morgan'}).json()['name']=='Maya Morgan'
    assert signed.get('/api/customers?q=Morgan').json()['total']==1
    assert signed.get('/api/customers?page=0').status_code==422
    assert signed.post('/api/customers',json={**CUSTOMER,'email':'wrong'}).status_code==422
    assert signed.delete(f'/api/customers/{cid}').status_code==200

def test_booking_server_prices_waiver_analytics_and_cancel(signed):
    r=signed.post('/api/bookings',json={**BOOKING,'price':1,'total':1})
    assert r.status_code==201,r.text
    b=r.json()
    assert b['total']==285
    assert signed.get(f"/api/bookings/{b['id']}").json()['waiver_signed'] is True
    assert signed.get('/api/customers/1').json()['bookings'][0]['id']==b['id']
    assert signed.delete('/api/customers/1').status_code==409
    d=signed.get('/api/analytics/dashboard').json()
    assert d['revenue']==285 and d['tickets_sold']==3 and d['average_booking']==285
    assert d['daily'][0]['bookings']==1
    assert signed.post('/api/bookings',json={**BOOKING,'quantity':0}).status_code==422
    assert signed.post('/api/bookings',json={**BOOKING,'customer_id':999}).status_code==422
    assert signed.delete(f"/api/bookings/{b['id']}").status_code==200
    assert signed.get('/api/analytics/dashboard').json()['revenue']==0

def test_ticket_price_changes_preserve_history(signed):
    b=signed.post('/api/bookings',json=BOOKING).json()
    assert signed.post('/api/tickets',json={'name':'VIP','price':200}).status_code==403
    signed.post('/api/auth/logout')
    r=signed.post('/api/auth/login',json={'email':'admin@example.com','password':'TestPassword2026!'})
    signed.headers['X-CSRF-Token']=r.json()['csrf']
    assert signed.put('/api/tickets/1',json={'name':'General','price':120,'active':True}).status_code==200
    changed=signed.put(f"/api/bookings/{b['id']}",json={**BOOKING,'quantity':2}).json()
    assert changed['total']==190
    assert signed.post('/api/bookings',json=BOOKING).json()['total']==360

def test_quality_detection():
    rows=[{'id':'1','name':'Maya','email':'wrong','phone':'abc'},{'id':'1','name':'','email':''}]
    r=validate_records(rows,'customers')
    assert r['total']==2 and r['invalid']==2 and r['duplicates']==1 and r['missing_values']==2
    assert r['categories']['format']>=2
    r=validate_records([{'id':'1','customer_id':'999','ticket_id':'999','booking_date':'not-a-date','visit_date':'2026-11-01','quantity':'0','price':'-5','status':'CONFIRMED'}],'bookings',{1},set(),set(),{1})
    assert {'date','quantity','price','status','reference'} <= set(r['categories'])

def test_import_review_is_atomic_and_preserves_original(signed):
    file=b'id,name,email,phone,status\n50,Maya,wrong,,active\n'
    r=signed.post('/api/data/import?kind=customers',files={'file':('customers.csv',file,'text/csv')})
    assert r.status_code==201,r.text
    log=r.json()
    assert log['report']['invalid']==1
    assert signed.get('/api/customers').json()['total']==1
    bad=signed.post(f"/api/data/imports/{log['id']}/review",json={'records':log['original'],'confirm':True})
    assert bad.status_code==422
    corrected=[{**log['original'][0],'email':'maya@example.com'}]
    assert signed.post(f"/api/data/imports/{log['id']}/review",json={'records':corrected,'confirm':False}).json()['valid']==1
    assert signed.get('/api/customers').json()['total']==1
    assert signed.post(f"/api/data/imports/{log['id']}/review",json={'records':corrected,'confirm':True}).status_code==200
    assert signed.get('/api/customers').json()['total']==2
    original=signed.get(f"/api/data/imports/{log['id']}").json()
    assert original['original'][0]['email']=='wrong'
    assert signed.post(f"/api/data/imports/{log['id']}/review",json={'records':corrected,'confirm':True}).status_code==409

def test_webhook_idempotency_failure_and_simulation(signed):
    r=signed.post('/api/integrations/ticketing/webhook?event_id=test-1',json=BOOKING)
    assert r.status_code==201
    assert signed.post('/api/integrations/ticketing/webhook?event_id=test-1',json=BOOKING).json()['duplicate_event']
    assert signed.get('/api/bookings').json()['total']==1
    assert signed.post('/api/integrations/ticketing/webhook?event_id=failed',json={**BOOKING,'customer_id':999}).status_code==422
    assert signed.get('/api/integrations/logs').json()[0]['status']=='failed'
    assert signed.post('/api/integrations/ticketing/simulate').status_code==200

def test_exports_and_upload_formats(signed):
    signed.post('/api/bookings',json=BOOKING)
    assert b'General' in signed.get('/api/reports/export?kind=tickets').content
    assert signed.get('/api/reports/export?kind=bookings&format=xlsx').content[:2]==b'PK'
    assert signed.get('/api/reports/export?kind=unknown').status_code==422
    assert signed.post('/api/data/import?kind=customers',files={'file':('bad.exe',b'abc')}).status_code==415
    assert signed.post('/api/data/validate').status_code==200

def test_bigquery_no_false_success_and_provider_failure(signed,monkeypatch):
    monkeypatch.delenv('BIGQUERY_PROJECT',raising=False)
    assert signed.post('/api/integrations/bigquery/sync').status_code==503
    assert signed.get('/api/integrations/bigquery').json()['last_success'] is None
    monkeypatch.setenv('BIGQUERY_PROJECT','fictional-test')
    generator=app.dependency_overrides[get_db]()
    db=next(generator)
    with patch('google.cloud.bigquery.Client',side_effect=RuntimeError('provider down')):
        result=sync_bigquery(db)
    assert result['status']=='failed' and result['records']==0
    generator.close()

def test_registration_staff_and_rate_limit(client):
    r=client.post('/api/auth/register',json={'email':'new@example.com','name':'New Staff','password':'SafePassword2026!','role':'administrator'})
    assert r.status_code==201 and r.json()['role']=='staff'
    client.headers['X-CSRF-Token']=r.json()['csrf']
    assert client.get('/api/users').status_code==403
    client.post('/api/auth/logout')
    for _ in range(16):
        r=client.post('/api/auth/login',json={'email':'absent@example.com','password':'wrong'})
    assert r.status_code==429
