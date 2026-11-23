import logging, os, secrets, time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from .database import engine,SessionLocal
from .services import seed
from .api import auth,records,data,analytics,system

logger=logging.getLogger('museum')
origins=[o.strip() for o in os.getenv('ALLOWED_ORIGINS','http://localhost:5173').split(',') if o.strip()]
if '*' in origins:
    raise RuntimeError('Use explicit CORS origins')

@asynccontextmanager
async def lifespan(app):
    if os.getenv('DEMO_SEED','false')=='true':
        with SessionLocal() as db:
            seed(db)
    scheduler=None
    if os.getenv('SCHEDULER_ENABLED','false')=='true':
        from apscheduler.schedulers.background import BackgroundScheduler
        from .automation import daily_job
        scheduler=BackgroundScheduler(timezone='UTC')
        scheduler.add_job(daily_job,'cron',hour=2,id='daily',max_instances=1,coalesce=True)
        scheduler.start()
    yield
    if scheduler:
        scheduler.shutdown(wait=False)

app=FastAPI(title='MuseumOS Business Data Platform',version='1.0.0',lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=True,allow_methods=['GET','POST','PUT','DELETE','OPTIONS'],allow_headers=['Content-Type','X-CSRF-Token'],expose_headers=['Content-Disposition','X-Request-ID'])

@app.middleware('http')
async def request_security(request:Request,call_next):
    started=time.monotonic()
    request_id=secrets.token_hex(8)
    if request.method in ['POST','PUT','DELETE','PATCH']:
        origin=request.headers.get('origin')
        if origin and origin not in origins:
            return JSONResponse({'detail':'Origin not allowed'},403)
        if request.cookies.get('museum_session'):
            cookie=request.cookies.get('museum_csrf','')
            token=request.headers.get('x-csrf-token','')
            if not cookie or not secrets.compare_digest(cookie,token):
                return JSONResponse({'detail':'CSRF token missing or invalid'},403)
    response=await call_next(request)
    response.headers['X-Request-ID']=request_id
    response.headers['X-Content-Type-Options']='nosniff'
    response.headers['Cache-Control']='no-store'
    logger.info('%s %s %s %.1fms request=%s',request.method,request.url.path,response.status_code,(time.monotonic()-started)*1000,request_id)
    return response

@app.exception_handler(IntegrityError)
async def integrity_error(request,exc):
    return JSONResponse({'detail':'Record conflicts with an existing ID, unique value or relationship'},409)

@app.exception_handler(Exception)
async def unhandled(request,exc):
    logger.exception('Unhandled request failure')
    return JSONResponse({'detail':'An unexpected server error occurred. Contact an administrator with the request time.'},500)

for router in [auth.router,records.router,data.router,analytics.router,system.router]:
    app.include_router(router)

@app.get('/health')
def health():
    with engine.connect() as db:
        db.execute(text('SELECT 1'))
    return {'status':'healthy'}
