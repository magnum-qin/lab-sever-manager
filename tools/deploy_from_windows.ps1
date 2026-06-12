param(
  [string]$JumpHost = "ts-win-jump",
  [string]$LinuxUser = "g24tka12",
  [string]$RemoteDir = "/home/g24tka12/lab-server-manager",
  [string]$ConfigPath = "$PSScriptRoot\..\config\hosts.example.json",
  [string]$AgentBinary = "$PSScriptRoot\..\dist\gpu-status-agent-linux-amd64"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."
$config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$agent = Resolve-Path $AgentBinary

foreach ($hostItem in $config.hosts) {
  $target = "$LinuxUser@$($hostItem.ip):$RemoteDir/"
  Write-Host "Deploying Go agent to $($hostItem.name) ($($hostItem.ip))"
  ssh "$LinuxUser@$($hostItem.ip)" "mkdir -p $RemoteDir"
  scp "$agent" "$target/gpu-status-agent"
  scp "$root\linux_agent\dashboard_probe.sh" "$root\linux_agent\install_agent.sh" $target
  ssh "$LinuxUser@$($hostItem.ip)" "bash $RemoteDir/install_agent.sh"
}

ssh $JumpHost "powershell -NoProfile -Command \"New-Item -ItemType Directory -Force -Path C:\\Users\\James\\lab-sever-manager | Out-Null\""
scp -r "$root\config" "$root\jump_host" "${JumpHost}:C:\Users\James\lab-sever-manager\"
Write-Host "Deployment finished. On the jump host, run C:\Users\James\lab-sever-manager\jump_host\start_gpu_tunnels.cmd and start_gpu_dashboard.cmd."
