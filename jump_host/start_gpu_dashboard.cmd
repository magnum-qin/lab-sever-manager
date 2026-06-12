@echo off
setlocal
cd /d "%~dp0.."
set LAB_MANAGER_CONFIG=%CD%\config\hosts.json
if not exist "%LAB_MANAGER_CONFIG%" set LAB_MANAGER_CONFIG=%CD%\config\hosts.example.json
python "%~dp0gpu_dashboard.py"
endlocal
