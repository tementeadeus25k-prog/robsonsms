@echo off
rem Abre o clone no navegador. Dá dois cliques neste arquivo e pronto.
cd /d "%~dp0public"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Este clone precisa do Node.js para ser servido localmente.
  echo  Instale em https://nodejs.org e abra de novo.
  echo.
  pause
  exit /b 1
)
start "" http://localhost:4173
node serve.mjs 4173
