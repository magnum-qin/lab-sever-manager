@echo off
setlocal
schtasks /Create /TN GPUStatusDashboard /SC ONLOGON /TR "\"%~dp0start_gpu_dashboard.cmd\"" /F
echo Installed GPUStatusDashboard scheduled task.
echo GPUStatusTunnels is not needed in direct agent mode.
endlocal
