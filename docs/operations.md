# Operations Guide

## Add Or Remove Hosts

Edit `config/hosts.json` on the jump host. Each host requires:

- `name`: display name.
- `ip`: LAN IP reachable from the jump host.
- `group`: display group, for example `A6000` or `RTX 4090`.
- `local_port`: jump-host loopback port mapped to the agent.

The dashboard reads `LAB_MANAGER_CONFIG` first, then `config/hosts.json`, then `config/hosts.example.json`.

## Restart Components

Windows jump host:

```cmd
taskkill /IM python.exe /F
jump_host\start_gpu_tunnels.cmd
jump_host\start_gpu_dashboard.cmd
```

Linux host:

```bash
bash /home/g24tka12/lab-server-manager/install_agent.sh
```

## Troubleshooting

Check a single tunnel on the jump host:

```powershell
Invoke-WebRequest http://127.0.0.1:18143/status -UseBasicParsing
```

Check the dashboard API:

```powershell
Invoke-RestMethod http://127.0.0.1:18080/api/status
```

If a tunnel port is already in use, find the process:

```powershell
netstat -ano | findstr :18143
```

Then stop the stale `ssh.exe` process or restart the jump-host scheduled task.
