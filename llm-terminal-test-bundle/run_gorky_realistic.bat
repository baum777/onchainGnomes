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
echo === Realistic Production Test Suite (No System Override) ===
python src\cli.py --mode file --file tests\prompts\gorky_realistic.jsonl --strict --log-file logs\gorky_realistic_run.ndjson
echo.
echo Tests completed. Review logs in the logs\ directory.
pause
