@echo off
rem Barnstorm (Carbarn's social media agent): double-click to start. Close this window to stop it.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Install it from https://nodejs.org and try again. & pause & exit /b 1)
if not exist node_modules (
  echo First run: installing the two small packages Barnstorm needs...
  call npm install --no-audit --no-fund || (pause & exit /b 1)
)
node server.js --open
pause
