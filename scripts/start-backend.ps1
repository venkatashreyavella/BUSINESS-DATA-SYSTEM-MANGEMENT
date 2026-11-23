$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath (Join-Path $taskRoot 'backend')
if (-not $env:DATABASE_URL) { $env:DATABASE_URL = 'sqlite:///./museum.db' }
$env:DEMO_SEED = 'true'
$env:ALLOWED_ORIGINS = 'http://localhost:5173,http://127.0.0.1:5173'
$taskPython = Join-Path $taskRoot '.venv313\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $taskPython)) { $taskPython = Join-Path $taskRoot '.venv\Scripts\python.exe' }
& $taskPython -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed' }
& $taskPython -m uvicorn app.main:app --host 127.0.0.1 --port 8000
