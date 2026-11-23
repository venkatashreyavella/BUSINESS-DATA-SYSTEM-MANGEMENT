# Verification record

Date: 23 November 2026 (Dubai).

## Executed locally

- Patched Python dependencies installed in `.venv313` (Python 3.13); original `.venv` is a legacy Python 3.10 environment.
- Explicit Alembic migration applied successfully to local SQLite; a separate disposable database passed upgrade → downgrade → upgrade.
- Demo startup populated 120 fictional customers, 260 bookings, four ticket categories and waiver records.
- Backend Pytest: **13 passed** on Python 3.13. Covered actual authentication/CSRF, CRM, bookings, database analytics, import review, data validation, exports, webhook idempotency, registration roles, throttling and BigQuery failure behaviour.
- Frontend Vitest: **6 passed**. Covered forms, login errors, protected navigation, server KPIs and validation action.
- Vite production build completed. The charting bundle currently emits a size warning; it does not fail the build.
- `npm audit` after build/test tool upgrades: **0 vulnerabilities** at that check.
- Generated clean sample CSVs (120 customers/240 bookings) and dirty customer/booking files.
- HTTP frontend returned 200; `/health` returned healthy.
- Browser demo sign-in succeeded, real SQL KPIs rendered, a customer was created and listed, and database validation generated two persisted reports.
- Browser exercised narrow/mobile layout and 1440px desktop layout.
- Browser uploaded `dirty_customers.csv`; the review showed 11 rows, 5 invalid rows, 1 duplicate row and 9 detailed flags. No upload rows were applied to business tables.
- Saved local dashboard and quality-history screenshots in `docs/screenshots/`.

The patched Python environment advisory scan reported **no known vulnerabilities**. Final tests emit one Starlette/httpx test-client deprecation warning; hosting targets Python 3.11. The running local API was restarted on Python 3.13.

## Not yet verified

- Docker engine was not running, so PostgreSQL Docker migration/runtime checks were not executed locally. GitHub CI is configured to exercise PostgreSQL 16 migrations and seeding after push.
- No real BigQuery account/credentials were supplied: only failure/unconfigured behaviour is tested, not a successful provider load.
- Source pushed to https://github.com/venkatashreyavella/BUSINESS-DATA-SYSTEM-MANGEMENT on `main`. Vercel deployment, Render service and Supabase provisioning remain pending.
- No public frontend/API/Swagger URL exists yet. No public access or cross-provider authentication result is claimed.
- No always-on scheduler or paid Cron service is provisioned.

## Public acceptance checks after provisioning

1. Open the public Vercel origin on desktop, phone and an incognito window.
2. Verify direct API data access without login returns 401, and public `/health` returns healthy.
3. Sign in with the fictional staff demo, create/edit/search a customer, reload and confirm persistence.
4. Create a booking and verify the backend-calculated amount, waiver, customer profile and dashboard figures. Cancel it and verify confirmed revenue decreases.
5. Import dirty CSV and XLSX files, inspect errors, preview corrections, confirm once, reject repeated application and verify original data retention.
6. Export CSV/Excel, open files, verify selected booking dates and compare totals with SQL.
7. Simulate a webhook and retry the same event ID; confirm only one booking is created.
8. Attempt administrator changes as staff (403); sign out (session revoked), then sign in as a privately bootstrapped administrator and manage staff access.
9. Execute a real BigQuery sync, verify job completion/count/table in Google Cloud; test a permission failure and confirm no false-success timestamp.
10. Redeploy Render and verify Supabase records survive. Inspect browser network requests for localhost URLs and cookie errors.
11. Verify production CORS accepts the intended Vercel origin only. Inspect audit and load logs.
12. Record actual frontend/backend/Swagger/GitHub URLs in README and deployment guide only after these checks.
