import io
import pandas as pd
from sqlalchemy import select
from app.database import get_db
from app.main import app
from app.models import User, Session
from app.quality import validate_records

def test_xlsx_staging_and_formula_safe_csv(signed):
    buffer=io.BytesIO()
    pd.DataFrame([{'name':'Safe Visitor','email':'safe@example.com','phone':'','status':'active'}]).to_excel(buffer,index=False)
    r=signed.post('/api/data/import?kind=customers',files={'file':('safe.xlsx',buffer.getvalue(),'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')})
    assert r.status_code==201,r.text
    staged=r.json()
    assert staged['report']['valid']==1
    assert signed.post(f"/api/data/imports/{staged['id']}/review",json={'records':staged['original'],'confirm':True}).status_code==200
    assert signed.post('/api/customers',json={'name':'=Test Formula','email':'formula@example.com','phone':'','status':'active'}).status_code==201
    result=signed.get('/api/reports/export?kind=customers')
    assert "'=Test Formula" in result.content.decode('utf-8-sig')

def test_invalid_import_identifier_is_reported_not_committed(signed):
    r=validate_records([{'id':'wrong','name':'Maya Reed','email':'maya@example.com'}],'customers')
    assert r['invalid']==1
    assert 'positive integer' in r['flagged'][0]['error']

def test_admin_role_change_revokes_other_sessions(signed):
    generator=app.dependency_overrides[get_db]()
    db=next(generator)
    staff=db.scalar(select(User).where(User.email=='staff@example.com'))
    assert db.scalars(select(Session).where(Session.user_id==staff.id)).all()
    # Switch browsers conceptually without signing staff out; preserve its session.
    old_cookie=signed.cookies.get('museum_session')
    signed.cookies.clear()
    r=signed.post('/api/auth/login',json={'email':'admin@example.com','password':'TestPassword2026!'})
    signed.headers['X-CSRF-Token']=r.json()['csrf']
    assert signed.put(f'/api/users/{staff.id}',json={'role':'staff','active':False}).status_code==200
    assert not db.scalars(select(Session).where(Session.user_id==staff.id)).all()
    signed.cookies.clear()
    signed.cookies.set('museum_session',old_cookie)
    assert signed.get('/api/auth/me').status_code==401
    generator.close()
