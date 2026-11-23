import re
from collections import Counter
from datetime import date
import pandas as pd
from .schemas import CustomerInput

def validate_records(records, kind, customer_ids=None, existing_ids=None, existing_emails=None, ticket_ids=None):
    """Pure validation: never mutates the upload or database."""
    flagged, categories, seen_ids, seen_emails, seen_rows = [], Counter(), set(), set(), set()
    invalid, duplicates, missing = set(), set(), 0
    for index, original in enumerate(records):
        row = {k: ('' if v is None else str(v).strip()) for k,v in original.items()}
        errors, proposals = [], {}
        signature = tuple(sorted(row.items()))
        if signature in seen_rows:
            errors.append(('duplicate', 'Exact duplicate record'))
        seen_rows.add(signature)
        rid = row.get('id', '')
        if rid:
            try:
                if int(rid) <= 0 or str(int(rid)) != rid:
                    raise ValueError()
            except ValueError:
                errors.append(('format', 'Record ID must be a positive integer'))
        if rid and (rid in seen_ids or rid in (existing_ids or set())):
            errors.append(('duplicate', 'Duplicate record ID'))
        if rid:
            seen_ids.add(rid)
        required = ['name', 'email'] if kind == 'customers' else ['customer_id','ticket_id','booking_date','visit_date','quantity','price','status']
        for field in required:
            if not row.get(field):
                errors.append(('missing', f'Missing {field}'))
                missing += 1
        if kind == 'customers':
            email = row.get('email', '').lower()
            if row.get('email') != email:
                proposals['email'] = email
            if email and (email in seen_emails or email in (existing_emails or set())):
                errors.append(('duplicate', 'Duplicate email'))
            if email:
                seen_emails.add(email)
            try:
                CustomerInput(name=row.get('name', ''), email=email, phone=row.get('phone',''), status=row.get('status') or 'active')
            except Exception as exc:
                for e in exc.errors():
                    errors.append(('format', f"{e['loc'][0]}: {e['msg']}"))
        else:
            for field in ['booking_date', 'visit_date']:
                try:
                    date.fromisoformat(row.get(field, ''))
                except ValueError:
                    errors.append(('date', f'Invalid {field}; use YYYY-MM-DD'))
            for field in ['customer_id','ticket_id','quantity']:
                try:
                    value = int(row.get(field, ''))
                    if value <= 0 or (field == 'quantity' and value > 1000):
                        raise ValueError()
                    reference = customer_ids if field == 'customer_id' else ticket_ids if field == 'ticket_id' else None
                    if reference is not None and value not in reference:
                        errors.append(('reference', f'Unknown {field}'))
                except ValueError:
                    errors.append(('quantity' if field == 'quantity' else 'reference', f'Invalid {field}'))
            try:
                price = float(row.get('price', ''))
                if not pd.notna(price) or price < 0 or price > 100000:
                    raise ValueError()
            except ValueError:
                errors.append(('price', 'Invalid or negative price'))
            status = row.get('status','')
            if status not in ['confirmed','pending','cancelled']:
                errors.append(('status', 'Invalid booking status'))
                if status.lower() in ['confirmed','pending','cancelled']:
                    proposals['status'] = status.lower()
        if errors:
            invalid.add(index)
        if any(e[0] == 'duplicate' for e in errors):
            duplicates.add(index)
        for category, description in errors:
            categories[category] += 1
            flagged.append({'row': index + 1, 'category': category, 'error': description, 'proposed': proposals, 'record': original})
    return {'total': len(records), 'valid': len(records)-len(invalid), 'invalid': len(invalid), 'duplicates': len(duplicates), 'missing_values': missing, 'validation_errors': len(flagged), 'categories': dict(categories), 'flagged': flagged}
