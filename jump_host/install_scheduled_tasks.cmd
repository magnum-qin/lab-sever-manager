@echo off
setlocal
schtasks /Create /TN GPUStatusTunnels /SC ONLOGON /TR "\"%~dp0start_gpu_tunnels.cmd\"" /F
schtasks /Create /TN GPUStatusDashboard /SC ONLOGON /TR "\"%~dp0start_gpu_dashboard.cmd\"" /F
echo Installed GPUStatusTunnels and GPUStatusDashboard scheduled tasks.
endlocal
