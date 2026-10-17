# Direct Pull Mode

The current deployment does not use SSH tunnels for monitoring.

Each Linux GPU host runs the Go agent on:

```text
0.0.0.0:18180
```

The agent requires this request header:

```text
X-Agent-Token: <your-token>
```

The Windows jump-host dashboard directly requests each host:

```text
http://<host-ip>:18180/status
```

The agent collects live CPU, memory, disk, GPU, and process data when `/status` is requested. Per-user `/home` usage is the exception: it is refreshed by `user_disk_cache_updater.sh` at low priority and read from cache during `/status`, so browser refreshes do not spawn expensive `du` scans.

Security properties:

- Requests without the token return `401 Unauthorized`.
- No jump-host-to-Linux SSH tunnel is needed for monitoring.
- The dashboard config controls the token through `dashboard.agent_token`.

Operational check from the jump host:

```powershell
Invoke-WebRequest -UseBasicParsing -Headers @{ 'X-Agent-Token' = '<your-token>' } http://10.0.0.11:18180/status
```


