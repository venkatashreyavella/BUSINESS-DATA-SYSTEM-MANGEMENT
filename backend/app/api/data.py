import io, json
from datetime import date
from decimal import Decimal
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select,text
from sqlalchemy.orm import Session
from ..database import get_db
from ..security import current_user
from ..models import Customer, Booking, Waiver, QualityLog
from ..schemas import CorrectionInput, CustomerInput
from ..services import quality_report, validate_database, audit, serialize, booking_rows

router=APIRouter(prefix='/api',tags=['Data quality and reports'])

@router.post('/data/import',status_code=201)
async def import_file(kind:str=Query(pattern='^(customers|bookings)$'),file:UploadFile=File(...),user=Depends(current_user),db:Session=Depends(get_db)):
    content=await file.read(5*1024*1024+1)
    if len(content)>5*1024*1024:
        raise HTTPException(413,'Maximum upload size is 5 MB')
    filename=(file.filename or '').lower()
    try:
        if filename.endswith('.csv'):
            frame=pd.read_csv(io.BytesIO(content),dtype=str,keep_default_na=False,nrows=10001)
        elif filename.endswith('.xlsx'):
            import zipfile
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if sum(i.file_size for i in archive.infolist())>30*1024*1024:
                    raise ValueError('Expanded workbook too large')
            frame=pd.read_excel(io.BytesIO(content),dtype=str,keep_default_na=False,nrows=10001)
        else:
            raise HTTPException(415,'Upload a CSV or XLSX file')
        if len(frame)>10000 or len(frame.columns)>50:
            raise ValueError('Limit is 10,000 rows and 50 columns')
        records=frame.fillna('').to_dict(orient='records')
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(422,'Cannot parse file. Check its format, size and row count.')
    report=quality_report(db,records,kind)
    log=QualityLog(kind=kind,source=(file.filename or 'Upload')[:255],original=records,report=report)
    db.add(log)
    db.flush()
    audit(db,user,'Staged import for review',id=log.id,kind=kind,rows=len(records))
    db.commit()
    return serialize(log)

@router.post('/data/validate')
def validate(user=Depends(current_user),db:Session=Depends(get_db)):
    results=validate_database(db)
    audit(db,user,'Validated database')
    db.commit()
    return {'reports':results}

@router.get('/data/quality-report')
def history(user=Depends(current_user),db:Session=Depends(get_db)):
    return [{k:v for k,v in serialize(r).items() if k!='original'} for r in db.scalars(select(QualityLog).order_by(QualityLog.id.desc()).limit(50))]

@router.get('/data/imports/{log_id}')
def get_import(log_id:int,user=Depends(current_user),db:Session=Depends(get_db)):
    log=db.get(QualityLog,log_id)
    if not log:
        raise HTTPException(404,'Import not found')
    return serialize(log)

@router.post('/data/imports/{log_id}/review')
def review(log_id:int,body:CorrectionInput,user=Depends(current_user),db:Session=Depends(get_db)):
    log=db.scalar(select(QualityLog).where(QualityLog.id==log_id).with_for_update())
    if not log or log.source=='Database validation':
        raise HTTPException(404,'Upload not found')
    if log.applied:
        raise HTTPException(409,'This import was already applied')
    reviewed=[{k:(v.strip() if isinstance(v,str) else v) for k,v in row.items()} for row in body.records]
    if log.kind=='customers':
        reviewed=[{**row,'status':row.get('status') or 'active'} for row in reviewed]
    report=quality_report(db,reviewed,log.kind)
    if not body.confirm:
        return report
    if report['invalid']:
        raise HTTPException(422,{'message':'Resolve all validation errors before importing','report':report})
    for record in reviewed:
        if log.kind=='customers':
            data=CustomerInput(**record).model_dump()
            if record.get('id'):
                data['id']=int(record['id'])
            db.add(Customer(**data))
        else:
            quantity=int(record['quantity'])
            price=Decimal(str(record['price']))
            b=Booking(customer_id=int(record['customer_id']),ticket_id=int(record['ticket_id']),quantity=quantity,price=price,total=price*quantity,booking_date=date.fromisoformat(record['booking_date']),visit_date=date.fromisoformat(record['visit_date']),status=record['status'])
            if record.get('id'):
                b.id=int(record['id'])
            db.add(b)
            db.flush()
            db.add(Waiver(booking_id=b.id,signed=False))
    log.applied=True
    db.flush()
    if db.bind.dialect.name=='postgresql':
        # Explicit imported IDs must advance the PostgreSQL serial sequence.
        table='customers' if log.kind=='customers' else 'bookings'
        db.execute(text(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE((SELECT MAX(id) FROM {table}), 1), true)"))
    # Original upload and initial report remain immutable; audit captures reviewed records.
    audit(db,user,'Confirmed reviewed import',id=log.id,records=body.records)
    db.commit()
    return {'message':f'Imported {len(body.records)} records','report':report}

def export_frame(records,filename,format):
    frame=pd.DataFrame(records)
    # Prevent spreadsheet formula execution in both CSV and XLSX exports.
    for col in frame.columns:
        frame[col]=frame[col].map(lambda v: "'"+v if isinstance(v,str) and v.lstrip().startswith(('=','+','-','@','\t','\r')) else v)
    buffer=io.BytesIO()
    if format=='xlsx':
        for col in frame.select_dtypes(include=['datetimetz']).columns:
            frame[col]=frame[col].astype(str)
        frame.to_excel(buffer,index=False,engine='openpyxl')
        media='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    else:
        buffer.write(frame.to_csv(index=False).encode('utf-8-sig'))
        media='text/csv'
    buffer.seek(0)
    return StreamingResponse(buffer,media_type=media,headers={'Content-Disposition':f'attachment; filename="{filename}.{format}"'})

@router.get('/reports/export')
def export(kind:str=Query('bookings',pattern='^(customers|bookings|revenue|tickets|quality)$'),format:str=Query('csv',pattern='^(csv|xlsx)$'),start:date|None=None,end:date|None=None,user=Depends(current_user),db:Session=Depends(get_db)):
    if kind=='customers':
        rows=[json.loads(json.dumps(serialize(c),default=str)) for c in db.scalars(select(Customer))]
    elif kind=='quality':
        rows=[{'report_id':r.id,**f} for r in db.scalars(select(QualityLog)) for f in r.report['flagged']]
        rows=[{k:json.dumps(v,default=str) if isinstance(v,(dict,list)) else v for k,v in r.items()} for r in rows]
    else:
        rows=booking_rows(db,start,end)
        if kind in ['revenue','tickets']:
            frame=pd.DataFrame([r for r in rows if r['status']=='confirmed'])
            if frame.empty:
                rows=[]
            else:
                group='booking_date' if kind=='revenue' else 'ticket_name'
                rows=frame.groupby(group,as_index=False).agg(revenue=('total','sum'),tickets=('quantity','sum'),bookings=('id','count')).to_dict('records')
    audit(db,user,'Exported report',kind=kind,format=format)
    db.commit()
    return export_frame(rows,kind,format)

@router.get('/data/imports/{log_id}/report')
def download_quality(log_id:int,user=Depends(current_user),db:Session=Depends(get_db)):
    log=db.get(QualityLog,log_id)
    if not log:
        raise HTTPException(404,'Report not found')
    return export_frame([{'row':f['row'],'category':f['category'],'error':f['error'],'proposed':str(f['proposed'])} for f in log.report['flagged']],f'validation-{log_id}','csv')
