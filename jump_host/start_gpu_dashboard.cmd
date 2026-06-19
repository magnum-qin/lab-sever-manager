@echo off
setlocal
cd /d "%~dp0.."
set LAB_MANAGER_CONFIG=%CD%\config\hosts.json
if not exist "%LAB_MANAGER_CONFIG%" set LAB_MANAGER_CONFIG=%CD%\config\hosts.example.json
if "%DASHBOARD_AGENT_TOKEN%"=="" echo DASHBOARD_AGENT_TOKEN is not set. The config file must provide dashboard.agent_token.
if exist "%CD%\dist\dashboard-api-windows-amd64.exe" (
  "%CD%\dist\dashboard-api-windows-amd64.exe"
) else (
  go run .\cmd\dashboard-api
)
endlocal
