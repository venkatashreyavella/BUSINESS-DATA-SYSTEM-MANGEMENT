"""External HTTP client: login, idempotent JSON webhook, bounded retries."""
import argparse,time,uuid,getpass
import httpx
parser=argparse.ArgumentParser()
parser.add_argument('--url',default='http://localhost:8000')
parser.add_argument('--customer',type=int,default=1)
parser.add_argument('--ticket',type=int,default=1)
args=parser.parse_args()
with httpx.Client(base_url=args.url,timeout=30) as client:
    login=client.post('/api/auth/login',json={'email':input('Staff email: '),'password':getpass.getpass('Password: ')})
    login.raise_for_status()
    client.headers['X-CSRF-Token']=login.json()['csrf']
    event='external-simulation-'+uuid.uuid4().hex
    from datetime import date
    body={'customer_id':args.customer,'ticket_id':args.ticket,'quantity':1,'visit_date':str(date.today()),'status':'confirmed'}
    for attempt in range(3):
        try:
            response=client.post('/api/integrations/ticketing/webhook',params={'event_id':event},json=body)
            response.raise_for_status()
            result=response.json()
            if not isinstance(result.get('booking_id'),int):
                raise ValueError('Unexpected response schema')
            print(result)
            break
        except (httpx.TransportError,httpx.HTTPStatusError) as exc:
            if isinstance(exc,httpx.HTTPStatusError) and exc.response.status_code<500:
                raise
            if attempt==2:
                raise
            time.sleep(2**attempt)
