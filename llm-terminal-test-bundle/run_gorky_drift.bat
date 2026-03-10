@echo off
setlocal
cd /d %~dp0
if not exist .venv (
  echo Creating virtual environment...
  python -m venv .venv
)
call .venv\Scripts\activate.bat
echo Installing requirements...
pip install -r requirements.txt
echo.
echo Running Gorky Drift Suite...
python src\cli.py --mode file --file tests\prompts\gorky_drift_suite.jsonl --system-file prompts\gorky_system.txt --strict --log-file logs\gorky_drift_run.ndjson
echo.
echo Done. Logs: logs\gorky_drift_run.ndjson
pause