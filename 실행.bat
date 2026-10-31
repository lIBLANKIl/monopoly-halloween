@echo off
setlocal
cd /d "%~dp0"
set PORT=8000
set "URL=http://localhost:%PORT%/%%EC%%A3%%BC%%EB%%A3%%A8%%EB%%A7%%88%%EB%%B8%%94.html"

rem Open the browser a moment after the server starts
start "" /b powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process '%URL%'"

echo Starting server at http://localhost:%PORT%/  (close this window to stop)
where python >nul 2>nul && ( python -m http.server %PORT% & goto :end )
where py >nul 2>nul && ( py -m http.server %PORT% & goto :end )
where npx >nul 2>nul && ( npx --yes serve -l %PORT% . & goto :end )

echo.
echo Python or Node.js was not found. Please install Python from https://www.python.org/downloads/
pause
:end
