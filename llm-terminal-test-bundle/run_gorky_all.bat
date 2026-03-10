@echo off
setlocal
cd /d %~dp0
if not exist .venv (
  echo Creating virtual environment...
  python -m venv .venv
)
call .venv\Scripts\activate.bat
echo Installing/Updating requirements...
pip install -r requirements.txt
echo.
echo === Persona Consistency ===
python src\cli.py --mode file --file tests\prompts\gorky_persona_consistency.jsonl --system-file prompts\gorky_system.txt --strict --log-file logs\gorky_persona_run.ndjson
echo.
echo === Drift Detection ===
python src\cli.py --mode file --file tests\prompts\gorky_drift_suite.jsonl --system-file prompts\gorky_system.txt --strict --log-file logs\gorky_drift_run.ndjson
echo.
echo Tests completed. Review logs in the logs\ directory.
pause