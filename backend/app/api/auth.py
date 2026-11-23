from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session as DB
from ..database import get_db
from ..models import User, Session
from ..schemas import Registration, Login, RoleInput
from ..security import passwords, current_user, start_session, rate_limit, digest, admin
from ..services import audit

router = APIRouter(prefix='/api',tags=['Authentication'])

@router.post('/auth/register',status_code=201,dependencies=[Depends(rate_limit)])
def register(body: Registration,response: Response,db: DB=Depends(get_db)):
    if db.scalar(select(User).where(User.email==str(body.email).lower())):
        raise HTTPException(409,'Email already registered')
    user=User(email=str(body.email).lower(),name=body.name,password_hash=passwords.hash(body.password),role='staff')
    db.add(user)
    db.flush()
    audit(db,user,'Registered staff account')
    return start_session(response,db,user)

@router.post('/auth/login',dependencies=[Depends(rate_limit)])
def login(body: Login,response: Response,db: DB=Depends(get_db)):
    user=db.scalar(select(User).where(User.email==str(body.email).lower()))
    # Verify against a real hash even for unknown accounts.
    valid=passwords.verify(body.password,user.password_hash if user else DUMMY_HASH)
    if not user or not valid or not user.active:
        raise HTTPException(401,'Invalid email or password')
    audit(db,user,'Signed in')
    return start_session(response,db,user)

DUMMY_HASH=passwords.hash('non-user-password')

@router.get('/auth/me')
def me(request: Request,user=Depends(current_user)):
    return {'id':user.id,'name':user.name,'email':user.email,'role':user.role,'demo':user.demo,'csrf':request.cookies.get('museum_csrf','')}

@router.post('/auth/logout')
def logout(request: Request,response: Response,user=Depends(current_user),db: DB=Depends(get_db)):
    session=db.get(Session,digest(request.cookies.get('museum_session','')))
    if session:
        db.delete(session)
    audit(db,user,'Signed out')
    db.commit()
    response.delete_cookie('museum_session',path='/')
    response.delete_cookie('museum_csrf',path='/')
    return {'message':'Signed out'}

@router.get('/users')
def users(user=Depends(admin),db: DB=Depends(get_db)):
    return [{'id':u.id,'email':u.email,'name':u.name,'role':u.role,'active':u.active,'demo':u.demo} for u in db.scalars(select(User).order_by(User.id))]

@router.put('/users/{user_id}')
def update_user(user_id:int,body:RoleInput,user=Depends(admin),db:DB=Depends(get_db)):
    target=db.get(User,user_id)
    if not target:
        raise HTTPException(404,'User not found')
    if target.demo or target.id==user.id:
        raise HTTPException(409,'Demo and current administrator accounts cannot be modified here')
    target.role=body.role
    target.active=body.active
    for session in db.scalars(select(Session).where(Session.user_id==target.id)):
        db.delete(session)
    audit(db,user,'Changed user access',target=user_id,role=body.role,active=body.active)
    db.commit()
    return {'message':'User access updated; existing sessions revoked'}
