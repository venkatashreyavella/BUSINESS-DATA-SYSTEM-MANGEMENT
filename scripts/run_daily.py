import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
from app.automation import daily_job
daily_job()
print('Daily job completed or was already claimed for today. Inspect job_runs for outcome.')
