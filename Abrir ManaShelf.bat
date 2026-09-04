@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel% neq 0 (
 echo No encontre Node.js instalado.
 echo Instala Node.js 20 o superior y volve a abrir este archivo.
 pause
 exit /b 1
)

rem Usa el primer puerto libre desde 3000 para no abrir accidentalmente otra instancia.
for /f %%P in ('powershell -NoProfile -Command "$p=3000; while(Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue){$p++}; Write-Output $p"') do set PORT=%%P

echo Iniciando ManaShelf v2.5.27-beta en http://127.0.0.1:%PORT%
start "ManaShelf v2.5.27-beta server" /D "%~dp0" cmd /k "set PORT=%PORT%&& node server.mjs"
timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/?build=2.5.27-beta"
exit /b 0
