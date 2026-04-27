@echo off
REM LinkedPilot Queue Worker Startup Script (Windows)
REM This script starts the background worker that processes pending actions

echo ==========================================
echo LinkedPilot Queue Worker
echo ==========================================
echo.

REM Check if virtual environment exists
if not exist "venv" (
    echo Warning: Virtual environment not found. Creating one...
    python -m venv venv
    echo Virtual environment created
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install/update dependencies
echo Installing dependencies...
pip install -q -r requirements.txt

REM Check if .env file exists
if not exist ".env" (
    echo Warning: .env file not found!
    echo Please create a .env file with the following variables:
    echo   - SUPABASE_URL
    echo   - SUPABASE_SERVICE_ROLE_KEY
    echo   - UNIPILE_API_KEY
    echo   - UNIPILE_DSN
    echo.
    exit /b 1
)

echo.
echo Starting worker...
echo Press Ctrl+C to stop
echo.

REM Start the worker
python worker.py
