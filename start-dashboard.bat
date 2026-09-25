@echo off
rem Starts Daily Command Center at http://localhost:8000 (backend + built frontend).
rem Builds the frontend first if it hasn't been built yet.

cd /d "%~dp0"

if not exist "frontend\dist\index.html" (
    echo Building frontend...
    pushd frontend
    call npm run build
    popd
)

cd backend
call myvenv\Scripts\activate.bat
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
