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
echo Running Gorky Persona Consistency Suite...
python src\cli.py --mode file --file tests\prompts\gorky_persona_consistency.jsonl --system-file prompts\gorky_system.txt --strict --log-file logs\gorky_persona_run.ndjson
echo.
echo Done. Logs: logs\gorky_persona_run.ndjson
pause