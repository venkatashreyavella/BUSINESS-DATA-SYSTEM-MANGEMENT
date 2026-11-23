# Deployment guide

Deployment is **pending**, not completed. The user has GitHub and Vercel accounts; Render, Supabase and Google Cloud access have not been connected. No account secrets are needed in chat. Enter them only in the relevant hosting secret settings or your local private environment.

## 1. GitHub

1. Sign in at https://github.com and create a new empty repository named `museumos-business-platform`. Choose private or public according to your portfolio preference. Do not initialize a README because source already exists here.
2. From this project root, review ignored files and commit source:

```powershell
git status --short
git add .
git commit -m "Build MuseumOS full-stack business data platform"
git remote add origin https://github.com/YOUR-USERNAME/museumos-business-platform.git
git push -u origin main
```

Use Git Credential Manager's browser login if prompted. Do not embed a token in the remote URL. The local repository is already initialized. If the remote exists, use it instead of creating another repository. A connected GitHub plugin can support this process when enabled in Codex.

## 2. Supabase PostgreSQL

1. Create an account/project at https://supabase.com/dashboard. Accept provider terms yourself and choose the available free tier if appropriate.
2. Choose a region near Render and retain the database password privately.
3. Open the project's Connect dialog and copy the **Session pooler** PostgreSQL URI (IPv4-compatible for a persistent backend). Set the password in that URI privately. Add `?sslmode=require` if absent.
4. Render `DATABASE_URL` uses SQLAlchemy's psycopg driver: `postgresql+psycopg://postgres.PROJECT:URL-ENCODED-PASSWORD@POOLER-HOST:5432/postgres?sslmode=require`. Use the exact host/username shown by Supabase, not an invented address.
5. Do not give the frontend a database password or service role key. This app does not need Supabase's browser SDK or Auth. The initial migration enables PostgreSQL row-level security on operational tables and adds no browser policies, denying access through Supabase's browser/Data API roles. The backend migration/runtime connection must own these tables (owners bypass RLS). If using a different runtime role, explicitly configure its limited access policies before switching. Do not disable RLS for browser access.

Connection modes and pooling differ: consult the [official Supabase guide](https://supabase.com/docs/guides/database/connecting-to-postgres). Alembic is responsible for schema creation; do not create the tables manually.

## 3. Render FastAPI

1. Create a Render account at https://dashboard.render.com and authorize only the intended GitHub repository.
2. Choose New → Blueprint, select the repository and apply `render.yaml`, or create a Python Web Service manually.
3. Root directory: `backend`. Python: `3.11.12`. Build: `pip install -r requirements.txt`. Start: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Health check: `/health`.
4. Set protected environment variables:

| Key | Production value |
|---|---|
| DATABASE_URL | Supabase session-pooler URI with SSL |
| SECRET_KEY | Generated random 32+ characters; Blueprint generates this |
| ENVIRONMENT | production |
| COOKIE_SECURE | true |
| ALLOWED_ORIGINS | Exact eventual Vercel production origin, e.g. https://your-project.vercel.app |
| DEMO_SEED | true for this fictional portfolio database |
| SCHEDULER_ENABLED | false on free sleeping services |

If the Vercel name is not known yet, use your expected origin, deploy Render, then update it with the exact Vercel URL before browser testing. Do not use `*`.

5. Deploy. Migrations run before the single API worker starts; startup seeds only an empty customer database.
6. Copy the real `https://...onrender.com` service URL. Open `/health` and confirm `{"status":"healthy"}`. Open `/docs` and check the generated API paths.
7. Bootstrap an administrator with `scripts/create_admin.py` from your local project using the Supabase `DATABASE_URL` in a private environment. Do not put passwords in command history or source. The free Render shell may be unavailable; the local script avoids that dependency.

See [Render's official FastAPI deployment guide](https://render.com/docs/deploy-fastapi).

## 4. Vercel React frontend

1. Replace **both** `https://REPLACE-BACKEND.onrender.com` destinations in `frontend/vercel.json` with the verified Render origin. Keep `/api/:path*` and `/health` suffixes. Commit and push this exact change.
2. In https://vercel.com/new choose the GitHub repository.
3. Framework: Vite. Root directory: `frontend`. Build command: `npm run build`. Output directory: `dist`. Node version: 24.
4. **Leave `VITE_API_URL` unset** in production. Axios uses same-origin requests, and Vercel rewrites proxy `/api` to Render. This avoids third-party-cookie blocking between `vercel.app` and `onrender.com`.
5. Deploy. Copy the real production origin into Render's `ALLOWED_ORIGINS` and redeploy Render if necessary. Use the production alias; changing preview origins must be added explicitly for testing.
6. Open the Vercel URL in a private browser window. Sign in with the fictional demo credentials. Create a customer, reload and verify persistence; create a booking; check analytics; upload a dirty file and inspect flags; export CSV and Excel; sign out and verify protected records are hidden.
7. Check a deep link such as `/customers` after reload and confirm SPA routing works.

External origin rewrites are documented by [Vercel](https://vercel.com/docs/routing/rewrites). If cookies fail, inspect the browser's Network panel for the proxied login response and Set-Cookie headers; use the same Vercel origin for all API calls. Never fall back to insecure cookie settings in production.

## 5. Google Cloud BigQuery

1. Create/sign in to a Google Cloud account at https://console.cloud.google.com. Create a dedicated fictional-demo project and note its project ID. Complete any terms or billing setup yourself.
2. Enable the BigQuery API. Open BigQuery and create the `museum_analytics` dataset in your chosen data location, or grant dataset creation permission to the service account. This application can create it when authorized.
3. Create a service account dedicated to MuseumOS. Grant **BigQuery Job User** on the project and **BigQuery Data Editor** on this dataset. Pre-create the dataset to avoid granting wider project data-editor access. Dataset creation by the application requires suitable project-level dataset creation permissions.
4. Prefer workload identity in a larger production system. For this Render demo, create a service-account JSON credential if allowed by your organization. Keep the downloaded file outside the repository and never upload it to GitHub.
5. Store its complete JSON as a Render **secret environment variable** named `GOOGLE_SERVICE_ACCOUNT_JSON`. Set `BIGQUERY_PROJECT` and `BIGQUERY_DATASET=museum_analytics`. Alternative: mount a protected secret file and set `GOOGLE_APPLICATION_CREDENTIALS` to its absolute path. Never configure both unnecessarily.
6. Redeploy the backend. Open Data warehouse. The state should read configured/unverified until a real operation completes.
7. Click Sync to BigQuery; wait, then Refresh history. Only a completed successful Google job produces `success`, a positive source-record count and a last-success timestamp.
8. In the Google console verify the `bookings` table and execute:

```sql
SELECT DATE_TRUNC(booking_date, MONTH) AS month,
       SUM(total) AS revenue
FROM `YOUR-PROJECT.museum_analytics.bookings`
WHERE status = 'confirmed'
GROUP BY month ORDER BY month;
```

The implementation uses the [official BigQuery Python client](https://docs.cloud.google.com/python/docs/reference/bigquery/latest/google.cloud.bigquery.client.Client). It loads an explicit schema, waits for the job result and replaces only the configured analytics snapshot table. Keep this dataset dedicated to fictional demo data.

## 6. Reliable automation

Free Render web services sleep after inactivity; an in-process scheduler cannot promise daily execution there. Leave it disabled on the free demo. For dependable daily processing, either use an always-on paid API with `SCHEDULER_ENABLED=true` or create a paid Render Cron Job:

- Repository/root/build: same backend settings.
- Schedule: `0 2 * * *` (UTC).
- Command: `python -c "from app.automation import daily_job; daily_job()"`.
- Protected environment: same database and BigQuery secrets.
- Keep the web scheduler disabled if using Cron.

The unique database day claim prevents duplicate daily work. Inspect `job_runs` for failed/running claims; investigate interrupted jobs before deliberately resetting a claim. Do not silently delete a claim to retry. Manual validation, warehouse sync and health checks remain available in the UI.

## 7. Verification and final URLs

Record real values after deployment:

| Item | Verified value |
|---|---|
| GitHub repository | Pending |
| Frontend | Pending |
| Render backend | Pending |
| Swagger | Backend + `/docs`, pending |
| Supabase persistence | Pending live verification |
| BigQuery successful job | Pending credentials/load |

Run the workflow checks in `docs/VERIFICATION.md` against the public origin. Confirm records survive a backend redeployment, no production requests target localhost, API reads require authentication and staff receive 403 on administrator endpoints. Do not label the deployment complete until those checks actually pass.

## Cost and service limits

Use free tiers where eligible; providers may require verification and may change limits. [Render Free documentation](https://render.com/docs/free) describes sleep and filesystem limits; [Render Cron documentation](https://render.com/docs/cronjobs) describes scheduled service setup and billing. Use external PostgreSQL for persistence, never the Render temporary filesystem. Vercel plan eligibility depends on intended use. Supabase free projects have quotas and may pause. Google BigQuery can incur storage/query charges; set billing budgets and use a dedicated small dataset. No paid resource has been provisioned during local implementation.
