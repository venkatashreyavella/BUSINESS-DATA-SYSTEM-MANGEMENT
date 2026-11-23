# Implementation phases

The request's phases are represented below. Code exists for phases 1–14; hosted deployment and production verification remain pending credentials. Verification was performed in consolidated suites after related modules were connected, rather than claiming every incomplete intermediate state had passed tests.

| Phase | Implementation / main files | Validation command or check |
|---|---|---|
| 1 Repository | `.gitignore`, `frontend/package.json`, `backend/requirements.txt`; isolated venv and Git main branch | `git status --short`, dependency installation |
| 2 Schema | `backend/app/models.py`, `database.py`, `migrations/versions/0001_initial.py` | `cd backend; python -m alembic upgrade head` (SQLite locally; PostgreSQL CI configured) |
| 3 Sample data | `scripts/generate_sample_data.py`, `seed_database.py`, `data/*.csv` | `python scripts/generate_sample_data.py`; startup loaded 120 customers / 260 bookings |
| 4 Authentication | `security.py`, `api/auth.py`, `schemas.py` | Pytest authentication, CSRF, revocation, roles, registration and rate-limit cases |
| 5 CRM | `api/records.py`, `pages/Records.jsx` | Pytest CRUD and duplicate test; browser persisted a new customer |
| 6 Bookings | `api/records.py`, models, customer/booking forms | Pytest prices/quantity/waiver/cancellation tests; Vitest booking interaction |
| 7 Quality | `quality.py`, `api/data.py`, `pages/Quality.jsx` | Pytest invalid rows, staged corrections, atomic import, original retention |
| 8 SQL analytics | `api/analytics.py`, `docs/sql-examples.sql` | Pytest exact revenue/ticket/count assertions |
| 9 APIs/simulation | API routers, `scripts/simulate_ticketing.py` | Pytest idempotent events, rejected references, simulation logs |
| 10 BigQuery | `services.py`, `api/system.py`, Warehouse page | Pytest unconfigured rejection/provider failure; live success pending credentials |
| 11 React | `src/App.jsx`, layouts/components/pages/styles | `npm run build`, `npm test`; local browser mobile/desktop checks |
| 12 Reports/jobs | exports, Operations pages, `automation.py` | CSV/XLSX API tests; job uniqueness is enforced by schema |
| 13 Security/tests | middleware, tests, startup guards, CI | `python -m pytest -q`; `npm test`; `npm audit` |
| 14 GitHub preparation | `.github/workflows/ci.yml`, README and hosting files | Source committed and pushed to the user-specified GitHub repository |
| 15 Deployment | `render.yaml`, `frontend/vercel.json`, `docs/DEPLOYMENT.md` | Pending Render/Supabase provisioning and authenticated Vercel/GitHub access |
| 16 Production checks | `docs/VERIFICATION.md` | Pending real public frontend/API URLs |

See README for exact shell setup commands and the deployment guide for account-specific commands. There are no fake live provider connections or placeholder successful loads. Local previews use SQLite only when PostgreSQL is not configured; production refuses SQLite.
