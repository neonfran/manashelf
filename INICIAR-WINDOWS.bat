@echo off
where node >nul 2>nul
if %errorlevel% neq 0 (
 echo No encontre Node.js instalado.
 echo Instala Node.js 20 o superior y volve a abrir este archivo.
 pause
 exit /b 1
)
start "" http://127.0.0.1:3000
node server.mjs
pause
