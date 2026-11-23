import os
os.environ['DATABASE_URL']='sqlite://'
os.environ['DEMO_SEED']='false'
os.environ['COOKIE_SECURE']='false'
os.environ['ENVIRONMENT']='test'
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from app.database import Base,get_db
from app.models import User,Ticket,Customer
from app.security import passwords,attempts
from app.main import app

@pytest.fixture
def client():
    engine=create_engine('sqlite://',connect_args={'check_same_thread':False},poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory=sessionmaker(engine,expire_on_commit=False)
    def override():
        with factory() as db:
            yield db
    app.dependency_overrides[get_db]=override
    attempts.clear()
    with factory() as db:
        db.add_all([User(email='staff@example.com',name='Test Staff',password_hash=passwords.hash('TestPassword2026!'),role='staff'),User(email='admin@example.com',name='Test Admin',password_hash=passwords.hash('TestPassword2026!'),role='administrator'),Ticket(name='General',price=95),Customer(name='Test Visitor',email='visitor@example.com',phone='',status='active')])
        db.commit()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    engine.dispose()

@pytest.fixture
def signed(client):
    response=client.post('/api/auth/login',json={'email':'staff@example.com','password':'TestPassword2026!'})
    assert response.status_code==200,response.text
    client.headers['X-CSRF-Token']=response.json()['csrf']
    return client
