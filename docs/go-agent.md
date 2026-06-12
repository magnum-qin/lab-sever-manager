# Go Agent

The Linux-side agent is a static Go binary. It replaces the earlier Python HTTP agent, so GPU hosts do not need a Python runtime for monitoring.

Build from Windows with a Go toolchain:

```powershell
$env:GO_EXE = "C:\path\to\go.exe"
tools\build_agent_windows.ps1
```

The output is:

```text
dist/gpu-status-agent-linux-amd64
```

Deploy it with:

```powershell
tools\deploy_from_windows.ps1
```

The Go agent still executes `dashboard_probe.sh`, which uses `nvidia-smi`, `/proc`, `free`, and `ps` for data collection.
