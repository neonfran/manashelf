@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js no esta instalado o no esta en PATH.
  echo Descargalo desde https://nodejs.org/
  echo.
  pause
  exit /b 1
)
start "" http://127.0.0.1:3000
node server.mjs
pause
