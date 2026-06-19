param(
  [string]$OutDir = "$PSScriptRoot\..\dist"
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Push-Location $root
try {
  $env:GOOS = "linux"
  $env:GOARCH = "amd64"
  go build -o "$OutDir\gpu-status-agent-linux-amd64" .\cmd\gpu-status-agent
  $env:GOOS = "windows"
  $env:GOARCH = "amd64"
  go build -o "$OutDir\dashboard-api-windows-amd64.exe" .\cmd\dashboard-api

  # Copy agent files to static dist folder for Scheme B one-click deploy
  $staticAgentDir = "$root\apps\dashboard-web\dist\agent"
  if (Test-Path "$root\apps\dashboard-web\dist") {
    New-Item -ItemType Directory -Force -Path $staticAgentDir | Out-Null
    Copy-Item "$OutDir\gpu-status-agent-linux-amd64" "$staticAgentDir\gpu-status-agent" -Force
    Copy-Item "$root\linux_agent\dashboard_probe.sh" "$staticAgentDir\dashboard_probe.sh" -Force
    Copy-Item "$root\linux_agent\user_disk_cache_updater.sh" "$staticAgentDir\user_disk_cache_updater.sh" -Force
    Copy-Item "$root\linux_agent\install_agent.sh" "$staticAgentDir\install_agent.sh" -Force
    Write-Host "Copied agent distribution files to static web directory for one-click deployment."
  }
}
finally {
  Remove-Item Env:\GOOS -ErrorAction SilentlyContinue
  Remove-Item Env:\GOARCH -ErrorAction SilentlyContinue
  Pop-Location
}
Write-Host "Built Linux agent and Windows dashboard API into $OutDir"
