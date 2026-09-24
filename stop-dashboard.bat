@echo off
rem Stops the dashboard server started by start-dashboard(-hidden).
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:"127.0.0.1:8000 .*LISTENING"') do (
    echo Stopping process %%p
    taskkill /PID %%p /F >nul
)
