@echo off
setlocal
cd /d "%~dp0"
call "%~dp0node_modules\.bin\dsh.cmd" web %*
if errorlevel 1 pause
