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
echo === Aggressive Reply Mode: ANALYST (Dry Sarcastic Roasts) ===
set AGGRESSIVE_MODE=analyst
python src\cli.py --mode file --file tests\prompts\gorky_realistic.jsonl --log-file logs\gorky_aggressive_analyst.ndjson
echo.
echo === Aggressive Reply Mode: HORNY (Slang/Energy Roasts) ===
set AGGRESSIVE_MODE=horny
python src\cli.py --mode file --file tests\prompts\gorky_realistic.jsonl --log-file logs\gorky_aggressive_horny.ndjson
echo.
echo Tests completed. Review logs in the logs\ directory.
pause
