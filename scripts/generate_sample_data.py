"""Reproducible fictional files, including deliberately invalid staging examples."""
import csv,random
from pathlib import Path
from datetime import date,timedelta
root=Path(__file__).resolve().parents[1]/'data'
root.mkdir(exist_ok=True)
rng=random.Random(42)
anchor=date(2026,11,23)
customers=[{'id':i+1001,'name':f'{["Amira","Oliver","Maya","Noah"][i%4]} Visitor {i+1}','email':f'fictional{i+1}@example.com','phone':f'+97150000{i:04}','status':'active'} for i in range(120)]
bookings=[{'id':i+1001,'customer_id':1001+i%120,'ticket_id':1+i%4,'booking_date':str(anchor-timedelta(days=rng.randrange(180))),'visit_date':str(anchor+timedelta(days=rng.randrange(30))),'quantity':rng.randint(1,5),'price':[95,240,60,150][i%4],'status':rng.choice(['confirmed','confirmed','pending','cancelled'])} for i in range(240)]
dirty_customers=[dict(c) for c in customers[:10]]
dirty_customers[0]['email']='not-an-email'
dirty_customers[1]['name']=''
dirty_customers[2]['email']=''
dirty_customers[3]['phone']='bad-phone'
dirty_customers.append(dict(dirty_customers[4]))
dirty_bookings=[dict(b) for b in bookings[:10]]
dirty_bookings[0]['booking_date']='invalid-date'
dirty_bookings[1]['quantity']=-2
dirty_bookings[2]['price']=-20
dirty_bookings[3]['status']='CONFIRMED'
dirty_bookings[4]['customer_id']=999999
dirty_bookings.append(dict(dirty_bookings[5]))
for name,rows in [('sample_customers',customers),('sample_bookings',bookings),('dirty_customers',dirty_customers),('dirty_bookings',dirty_bookings)]:
    with (root/f'{name}.csv').open('w',newline='',encoding='utf-8') as f:
        writer=csv.DictWriter(f,fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
print('Generated 120 customers, 240 bookings and two deliberately invalid staging files.')
