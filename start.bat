@echo off
echo ========================================================
echo   DTF Gang Sheet Studio - Launching Application
echo ========================================================
echo.

start cmd /k "echo Starting Backend API... && python -m uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload"
start cmd /k "echo Starting Frontend Studio... && npm run dev"

echo Application launched!
echo Frontend: http://localhost:5173
echo Backend API: http://127.0.0.1:8000/docs
pause

