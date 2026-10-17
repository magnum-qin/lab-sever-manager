param(
  [string]$JumpHost = "windows-jump",
  [string]$LinuxUser = "g24tka12",
  [string]$RemoteDir = "/home/g24tka12/lab-server-manager",
  [string]$ConfigPath = "$PSScriptRoot\..\config\hosts.example.json",
  [string]$AgentBinary = "$PSScriptRoot\..\dist\gpu-status-agent-linux-amd64",
  [string]$DashboardBinary = "$PSScriptRoot\..\dist\dashboard-api-windows-amd64.exe"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$agentToken = $env:DASHBOARD_AGENT_TOKEN
if (-not $agentToken -and $config.dashboard.agent_token -and $config.dashboard.agent_token -ne "set-real-token-here") {
  $agentToken = $config.dashboard.agent_token
}
$agent = Resolve-Path $AgentBinary

foreach ($hostItem in $config.hosts) {
  $target = "$($hostItem.name):$RemoteDir/"
  Write-Host "Deploying Go agent to $($hostItem.name) ($($hostItem.ip))"
  ssh "$($hostItem.name)" "mkdir -p $RemoteDir"
  scp "$agent" "$target/gpu-status-agent.new"
  ssh "$($hostItem.name)" "mv -f $RemoteDir/gpu-status-agent.new $RemoteDir/gpu-status-agent"
  scp "$root\linux_agent\dashboard_probe.sh" "$root\linux_agent\install_agent.sh" "$root\linux_agent\user_disk_cache_updater.sh" $target
  if ($agentToken) {
    ssh "$($hostItem.name)" "AGENT_TOKEN='$agentToken' bash $RemoteDir/install_agent.sh"
  } else {
    ssh "$($hostItem.name)" "bash $RemoteDir/install_agent.sh"
  }
}

ssh $JumpHost "powershell -NoProfile -Command New-Item -ItemType Directory -Force -Path C:\Users\James\lab-sever-manager"
scp -r "$root\config" "$root\jump_host" "${JumpHost}:C:\Users\James\lab-sever-manager\"
if (Test-Path $DashboardBinary) {
  ssh $JumpHost "powershell -NoProfile -Command New-Item -ItemType Directory -Force -Path C:\Users\James\lab-sever-manager\dist"
  scp "$DashboardBinary" "${JumpHost}:C:\Users\James\lab-sever-manager\dist\dashboard-api-windows-amd64.exe"
}
Write-Host "Deployment finished. On the jump host, run C:\Users\James\lab-sever-manager\jump_host\start_gpu_dashboard.cmd."

