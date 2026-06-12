param(
  [string]$BaseUrl = "http://100.99.99.99:18080"
)

$ErrorActionPreference = "Stop"
$status = Invoke-RestMethod -Uri "$BaseUrl/api/status" -TimeoutSec 10
$status.hosts | Select-Object name, group, ip, port, @{n="gpu";e={$_.gpu.name}}, @{n="gpu_util";e={$_.gpu.util_gpu}}, @{n="vram_mb";e={"$($_.gpu.mem_used_mb)/$($_.gpu.mem_total_mb)"}}, @{n="error";e={$_.error}} | Format-Table -AutoSize
