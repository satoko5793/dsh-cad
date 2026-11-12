@echo off
setlocal
cd /d "%~dp0"
node "%~dp0scripts\start-cad.mjs" %*
if errorlevel 1 pause
