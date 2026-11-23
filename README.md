# MuseumOS — Business Data & Systems Management

A functional full-stack portfolio application for a fictional interactive museum. Visitors, bookings, data validation, SQL analytics and integrations share a persistent relational data model. All customers and transactions are fictional.

**Deployment status: not deployed.** Public frontend, backend and Swagger URLs are pending account connections and provisioning. No public URL is claimed. Source repository: [https://github.com/venkatashreyavella/BUSINESS-DATA-SYSTEM-MANGEMENT](https://github.com/venkatashreyavella/BUSINESS-DATA-SYSTEM-MANGEMENT).

## Problem and objectives

Visitor records, ticketing exports and business reporting often drift apart. MuseumOS demonstrates a Data and Systems Intern workflow: collect structured records, enforce relationships, stage incoming files, review data issues, persist approved changes, report from SQL and load a separate analytical warehouse.

## Features

- Staff registration, Argon2 password hashing, opaque revocable sessions, CSRF protection, protected APIs and administrator access controls.
- CRM create/edit/delete, customer profiles with booking history, search, status filtering, pagination and exports.
- Booking create/edit/cancel, ticket product management, price snapshots, quantity validation, status filtering, booking/visit date filters and waiver records.
- Database-derived KPIs, monthly revenue, daily activity, customer activity, category sales and booking status charts. Revenue and tickets sold count **confirmed bookings only**; customer count includes all customers regardless of the selected booking period.
- CSV/XLSX uploads with Pandas, 5 MB/10,000-row limits, duplicate detection, required fields, date/email/phone/quantity/price/status/reference checks, flagged records and proposed normalizations.
- Manual correction of staged records, validation preview and explicit confirmation before transactional insertion. Original upload records and initial reports are retained. Imports never overwrite existing business records.
- CSV/XLSX reports with spreadsheet formula escaping, audit history and a simulated ticketing webhook with idempotent external event IDs.
- Real Google BigQuery client integration, explicit unconfigured mode, verified load completion and success/failure history.
- Manual validation and system health checks; optional daily UTC scheduler with a unique database job claim to avoid duplicate daily execution.

## Stack

React 19, Vite, JavaScript, Tailwind 4, Recharts, Axios and React Router; Python/FastAPI/Pydantic/SQLAlchemy/Pandas; PostgreSQL with Alembic migrations; Google Cloud BigQuery Python client; Pytest and Vitest; Docker and GitHub Actions. Node 24 and Python 3.11 are the deployment targets. Final verification used Python 3.13 after updating dependencies; Python 3.10 is not supported by the patched requirement set.

Frontend dependencies are resolved in `frontend/package-lock.json`. Backend top-level versions are pinned in `backend/requirements.txt`. Install **Python 3.11 or newer**; patched DNS dependencies do not support Python 3.10. This workspace also contains `.venv313`, a separate Python 3.13 verification environment; the launcher prefers it when present.

## Architecture

```mermaid
flowchart LR
  Visitor[Authenticated staff / administrator] --> Web[React / Vercel]
  Web -->|same-origin /api proxy| API[FastAPI / Render]
  API --> DB[(Supabase PostgreSQL)]
  API --> Validation[Pandas staging and validation]
  Validation -->|review + confirmation| DB
  Simulator[Explicit ticketing simulation] -->|JSON / idempotent webhook| API
  API -->|official client / verified load job| BQ[(Google BigQuery)]
  Scheduler[Daily job with unique database claim] --> API
```

Vercel proxies API requests to Render so authentication cookies are first-party. Do not set a localhost API address in a production build. Raw Supabase database credentials and Google credentials remain exclusively on the backend.

## Repository

```text
backend/app/          models, database, security, schemas and services
backend/app/api/      authentication, business records, data, analytics, system
backend/migrations/  explicit Alembic schema migration
backend/tests/       API, security, import, analytics and failure tests
frontend/src/        components, context, services and connected pages
data/                clean sample files and intentionally invalid uploads
scripts/             sample generation, seeding, administrator and HTTP simulator
docs/                deployment, verification, SQL examples and phase record
```

## Database schema

| Table | Purpose and constraints |
|---|---|
| users | Unique email, password hash, role, active/demo flags |
| sessions | Hashed opaque session ID, user foreign key, expiry |
| customers | Unique indexed email, name, phone, status, registration timestamp |
| tickets | Unique product name, nonnegative price, availability |
| bookings | Customer/ticket foreign keys, unique external event ID, dates, status, price snapshot, constrained quantity |
| waivers | Unique booking foreign key, signed state and timestamp |
| data_quality_logs | Immutable original row snapshots and initial reports, applied flag |
| integration_logs | Timestamped simulated provider outcomes |
| audit_logs | Actor, action and structured details |
| synchronisation_logs | Actual warehouse load outcomes and verified counts |
| job_runs | Unique job/day claim with completion status |

Customer deletion is rejected when booking references exist. Booking deletion cancels the record, retaining history. Ticket price updates do not change historical booking amounts. All application writes use SQLAlchemy parameters and transactions. Imported explicit IDs advance PostgreSQL sequences.

## Run locally on Windows

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
npm install --prefix frontend
```

For an immediate SQLite development preview (persistent local file; not used in production):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1
```

In a second terminal:

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173. API: http://localhost:8000. Swagger: http://localhost:8000/docs. The Vite development proxy keeps browser API requests on the frontend origin. The included launcher migrates and seeds automatically.

### PostgreSQL development (preferred)

Start Docker Desktop, then:

```powershell
docker compose up --build -d
cd frontend
npm run dev
```

PostgreSQL uses a named volume. Docker credentials in the compose file are development-only. Stop with `docker compose down` without `-v` to retain records.

To run Python directly against PostgreSQL instead of the API container:

```powershell
docker compose up -d db
$env:DATABASE_URL='postgresql+psycopg://museum:museum@localhost:5432/museum'
powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1
```

### Demo login

Email: **demo@museum.example**

Password: **MuseumDemo2026!**

The demo is a fictional shared **staff** account. It cannot manage users or ticket products. It can create/edit fictional business records. New registrations also become staff. No administrative password is included in source.

Create an administrator interactively after migrations:

```powershell
.\.venv\Scripts\python.exe scripts\create_admin.py
```

Ensure `DATABASE_URL` points at the same database as the API. The password is prompted privately, hashed with Argon2 and never passed as a command argument.

## Environment configuration

Copy `.env.example` to `.env` and replace values. Shell commands do not automatically read this file; use `uvicorn --env-file ../.env` from `backend/`, load values in your shell, or set them in the hosting dashboard. Never commit `.env`.

| Variable | Purpose |
|---|---|
| DATABASE_URL | PostgreSQL SQLAlchemy URL; production refuses SQLite |
| SECRET_KEY | At least 32 random characters in production; changes invalidate sessions |
| ENVIRONMENT | `production` enables mandatory secure-cookie/PostgreSQL checks |
| COOKIE_SECURE | `true` in production, `false` for HTTP localhost |
| ALLOWED_ORIGINS | Comma-separated exact frontend origins, no wildcard |
| DEMO_SEED | `true` inserts 120 customers, 260 bookings and four products into an empty DB |
| BIGQUERY_PROJECT | Google project ID; unset means warehouse unavailable |
| BIGQUERY_DATASET | Dataset name, default `museum_analytics` |
| GOOGLE_SERVICE_ACCOUNT_JSON | Protected service-account JSON secret on Render |
| GOOGLE_APPLICATION_CREDENTIALS | Alternative protected credential file path |
| SCHEDULER_ENABLED | `true` only on an always-running single scheduler instance |
| VITE_API_URL | Local direct API override; leave unset in production to use Vercel proxy |

## Data cleaning workflow

1. Upload `data/dirty_customers.csv` on Data quality. This only stores staging records.
2. Inspect duplicate, missing, format and reference errors. Download a CSV validation report.
3. Open Review and edit the staged JSON array. Correct or remove offending rows. Original rows remain unchanged.
4. Click Validate corrections to preview the current result.
5. Click Import reviewed records, then Confirm import. The backend locks the upload, validates again and inserts all rows in one transaction or rejects the entire batch.
6. Review audit and quality history. Repeat application of the same batch is rejected.

Clean customer CSV columns: `id,name,email,phone,status`. IDs are optional. Booking CSV columns: `id,customer_id,ticket_id,booking_date,visit_date,quantity,price,status`. Dates use ISO `YYYY-MM-DD`. Import clean customers before related sample bookings. `sample_*.csv` IDs start at 1001 to avoid the seeded IDs. Deliberately invalid values belong in staging files, where they can be inspected without violating production constraints.

```powershell
.\.venv\Scripts\python.exe scripts\generate_sample_data.py
.\.venv\Scripts\python.exe scripts\seed_database.py
```

The CSV generator uses fixed random seed 42 and a fixed date anchor; database seeding uses seed 42 with dates relative to installation day so the dashboard stays relevant.

## API documentation

All `/api` data endpoints require a session. Mutation requests with a session require `X-CSRF-Token` from login or `/auth/me`. Interactive Swagger can read the current session; supply the CSRF header via an API client for mutations. `/health` is public.

| Area | Endpoints |
|---|---|
| Authentication | POST `/api/auth/register`, `/login`, `/logout`; GET `/api/auth/me` |
| Customers | GET/POST `/api/customers`; GET/PUT/DELETE `/api/customers/{id}` |
| Bookings | GET/POST `/api/bookings`; GET/PUT/DELETE `/api/bookings/{id}` |
| Ticket products | GET/POST `/api/tickets`; PUT `/api/tickets/{id}` (writes administrator-only) |
| Analytics | GET `/api/analytics/dashboard`, `/revenue`, `/bookings` |
| Data quality | POST `/api/data/import?kind=customers`, `/api/data/validate`; GET `/api/data/quality-report` |
| Import review | GET `/api/data/imports/{id}`; POST `/{id}/review`; GET `/{id}/report` |
| Reporting | GET `/api/reports/export?kind=bookings&format=xlsx` |
| Integrations | GET `/api/integrations/status`, `/logs`, `/bigquery`; POST `/bigquery/sync`, `/ticketing/simulate`, `/ticketing/webhook?event_id=...` |
| System | GET `/health`, `/api/system/status`, `/api/activity` |
| Users | GET `/api/users`; PUT `/api/users/{id}` (administrator-only) |

List queries support pagination and status/search filters; bookings add `start`, `end`, `visit` dates. Analytics accepts `start`/`end`. Exports support customers/bookings/revenue/tickets/quality and CSV/XLSX. Export dates apply to booking-derived reports; customer and quality exports are global.

Eight annotated PostgreSQL examples and a BigQuery monthly-revenue query are in [docs/sql-examples.sql](docs/sql-examples.sql). API routes `/analytics/*` execute real SQL aggregates through SQLAlchemy.

## Ticketing integration and automation

The Integrations page creates an explicitly fictional booking via the webhook service. The standalone script demonstrates actual HTTP requests, response validation, the same event ID on retries, bounded exponential backoff for network/5xx errors, and no retry for permanent 4xx failures:

```powershell
.\.venv\Scripts\python.exe scripts\simulate_ticketing.py --url http://localhost:8000 --customer 1 --ticket 1
```

Every successful or rejected domain event is logged. JSON/schema errors receive FastAPI 422 responses. Repeated event IDs return the previously created booking. Database uniqueness also protects simultaneous duplicate events.

Daily automation runs validation and, if configured, warehouse loading at **02:00 UTC (06:00 Dubai)**. A unique `(job name, day)` claim prevents duplicate execution across processes/restarts. Failed or interrupted runs remain recorded for operator investigation rather than being retried automatically. Do not enable APScheduler on sleeping free instances. Use an always-on service or the documented paid Render cron option. Manual warehouse jobs use FastAPI background tasks; process restart may interrupt a job, so verify history and retry. Analytics snapshot loads are repeatable.

## BigQuery

Without credentials, PostgreSQL remains fully usable and the warehouse page shows **not configured**. A sync request receives 503 and a non-success log. With credentials, the official client creates the configured dataset/table if permitted, validates source rows, submits a full snapshot load with `WRITE_TRUNCATE` and waits for `job.result()` before recording success. A failed job records zero synchronised records. Merely setting environment variables displays **configured, unverified**, never a successful connection.

Setup, minimum permissions, protected credentials and verification are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Do not point this demo at an existing analytical table you need to preserve: successful snapshot loads replace the configured `bookings` warehouse table.

## Tests and checks

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest -q
cd ..\frontend
npm test
npm run build
npm audit
```

Pytest checks authentication/CSRF/logout, staff permissions, registration escalation prevention, customer CRUD/duplicates, booking arithmetic/waivers/cancellation, retained prices, SQL analytics, import review atomicity, invalid records, exports, event idempotency, rate limiting and BigQuery failure reporting. Vitest exercises actual form entry/submission, login errors, navigation, server KPI rendering and quality actions. GitHub Actions additionally runs migrations and seeding against PostgreSQL 16.

Session verification results and limits are in [docs/VERIFICATION.md](docs/VERIFICATION.md); implementation phases and exact commands are in [docs/PHASES.md](docs/PHASES.md).

## Public deployment

Follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for GitHub → Supabase → Render → Vercel → BigQuery. Hosting files are included; the Render backend URL in `frontend/vercel.json` must be replaced after provisioning. The configuration intentionally fails until a real backend URL is supplied.

| Deliverable | Current state |
|---|---|
| Public frontend URL | Pending deployment |
| Backend URL | Pending Render service |
| Public Swagger URL | Pending backend URL + `/docs` |
| GitHub URL | https://github.com/venkatashreyavella/BUSINESS-DATA-SYSTEM-MANGEMENT |
| Local frontend | http://localhost:5173 while preview is running |
| Local API docs | http://localhost:8000/docs while backend is running |

## Screenshots

Screenshots from the verified local workspace represent local testing, not public deployment.

![Dashboard](docs/screenshots/dashboard.jpg)
![Data quality](docs/screenshots/data-quality.jpg)

## Reliability limits and future improvements

This is a portfolio implementation, not an independently certified production system. The initial implementation targets a small fictional business. Booking list joins and CSV/Excel report processing materialize rows in memory; add SQL-level pagination/streaming for large datasets. Rate limiting is per process and needs a shared gateway/Redis store for multi-instance deployment. Manual jobs need a durable task queue for reliable execution across restarts. Add email verification/password recovery, shared demo quotas/reset, retention rules, stronger audit access policies, migrations for subsequent schema changes, warehouse incremental loads and deployment monitoring before handling real business data.
