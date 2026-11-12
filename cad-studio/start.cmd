@echo off
cd /d "%~dp0"
node "%~dp0..\scripts\start-cad.mjs" %*
if errorlevel 1 pause
