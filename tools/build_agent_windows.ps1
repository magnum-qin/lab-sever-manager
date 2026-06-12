# Build the Linux agent from Windows.

$ErrorActionPreference = "Stop"
$root = Resolve-Path "$PSScriptRoot\.."
$go = $env:GO_EXE
if (-not $go) { $go = "go" }

Push-Location $root
try {
  $env:CGO_ENABLED = "0"
  $env:GOOS = "linux"
  $env:GOARCH = "amd64"
  & $go build -trimpath -ldflags "-s -w" -o "$root\dist\gpu-status-agent-linux-amd64" .\cmd\gpu-status-agent
}
finally {
  Pop-Location
}

Write-Host "Built $root\dist\gpu-status-agent-linux-amd64"
