@echo off
setlocal
schtasks /Create /TN GPUStatusDashboard /SC ONLOGON /TR "\"%~dp0start_gpu_dashboard.cmd\"" /F
schtasks /Change /TN GPUStatusTunnels /DISABLE >nul 2>nul
if not errorlevel 1 echo Disabled legacy GPUStatusTunnels scheduled task.
echo Installed GPUStatusDashboard scheduled task.
echo GPUStatusTunnels is not needed in direct agent mode.
endlocal
