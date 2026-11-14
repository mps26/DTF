@echo off
echo ========================================================
echo   DTF Gang Sheet Studio - Launching Application
echo ========================================================
echo.

if exist "%APPDATA%\fnm\node-versions\v26.13.1\installation" (
    set "PATH=%APPDATA%\fnm\node-versions\v26.13.1\installation;%PATH%"
)

start cmd /k "echo Starting Backend API... && python -m uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload"
start cmd /k "echo Starting Frontend Studio... && npm run dev"

echo Application launched!
echo Frontend (Local):   http://localhost:5173
echo Frontend (Phone):   Check Network IP shown in the Frontend window!
echo Backend API Docs:   http://127.0.0.1:8000/docs
pause


