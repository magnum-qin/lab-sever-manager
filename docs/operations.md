# Operations Guide

## Add Or Remove Hosts

Edit `config/hosts.json` on the Windows jump host. Each host requires:

- `name`: display name.
- `ip`: LAN IP reachable from the jump host.
- `group`: display group, for example `A6000` or `RTX 4090`.
- Optional `agent_port`: per-host override; defaults to `dashboard.agent_port` and normally stays `18180`.

The dashboard reads `LAB_MANAGER_CONFIG` first, then `config/hosts.json`, then `config/hosts.example.json`.

## Restart Components

Windows jump host:

```cmd
taskkill /IM dashboard-api-windows-amd64.exe /F
schtasks /Run /TN GPUStatusDashboard
```

Linux host:

```bash
bash /home/g24tka12/lab-server-manager/install_agent.sh
```


## Linux Agent Autostart

`linux_agent/install_agent.sh` installs two user-level systemd services:

- `gpu-status-agent.service`: serves `:18180/status`.
- `gpu-status-user-disk-cache.service`: refreshes cached per-user `/home` usage.

The script also installs an `@reboot` crontab fallback marked `lab-server-manager agent autostart`. The fallback does not store the token in crontab; it reuses the `600`-permission env file written by the installer. This keeps the agent recoverable on hosts where user systemd or lingering behaves differently after reboot.

Check one host:

```bash
systemctl --user is-enabled gpu-status-agent.service
systemctl --user is-active gpu-status-agent.service
crontab -l | grep 'lab-server-manager agent autostart'
curl -H 'X-Agent-Token: <your-token>' http://127.0.0.1:18180/status
```

If `systemctl --user` does not start after boot until login, enable lingering for the Linux user when allowed:

```bash
loginctl enable-linger g24tka12
```
## Health Checks

Check the dashboard API from a Tailscale client:

```powershell
Invoke-WebRequest -UseBasicParsing http://100.99.99.99:18080/health
Invoke-RestMethod http://100.99.99.99:18080/api/status
```

Check one Linux agent from the jump host:

```powershell
Invoke-WebRequest -UseBasicParsing -Headers @{ 'X-Agent-Token' = '<your-token>' } http://192.168.2.143:18180/status
```

## Troubleshooting

If the dashboard page is stale or the port is already in use, find the owning process on the jump host:

```cmd
netstat -ano | findstr :18080
tasklist
```

Stop stale `python.exe` or `dashboard-api-windows-amd64.exe` processes, then start `GPUStatusDashboard` again.

If a server is online but GPU fields are unavailable, check `nvidia-smi` on that Linux host. NVML or driver mismatch errors are shown as dashboard warnings instead of host downtime.


## One-Click HTTP Agent Deployment

When the Dashboard API is running on the jump host, it automatically hosts the agent setup scripts and compiled binaries under the `/agent` directory.

To deploy the agent on a new Linux server:
1. Log into the Linux server.
2. Run the following command (replace `<JUMP-HOST-IP>` with the jump host's Tailscale/local IP and set your agent token):
   ```bash
   curl -sSL http://<JUMP-HOST-IP>:18080/agent/install_agent.sh | AGENT_TOKEN="suzuki-lab" DOWNLOAD_URL="http://<JUMP-HOST-IP>:18080/agent" bash
   ```

This bootstrap installer will automatically:
- Download `gpu-status-agent`, `dashboard_probe.sh`, and `user_disk_cache_updater.sh` from the dashboard server.
- Create user-level systemd service configuration files.
- Enable lingering for the current user and start the services.
- Setup crontab backup autostart fallbacks.


