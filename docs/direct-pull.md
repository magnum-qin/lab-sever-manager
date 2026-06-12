# Direct Pull Mode

The current deployment does not use SSH tunnels for monitoring.

Each Linux GPU host runs the Go agent on:

```text
0.0.0.0:18180
```

The agent requires this request header:

```text
X-Agent-Token: suzuki-lab
```

The Windows jump-host dashboard directly requests each host:

```text
http://<host-ip>:18180/status
```

The agent still collects data only when `/status` is requested. It does not continuously scan the machine in the background.

Security properties:

- Requests without the token return `401 Unauthorized`.
- No jump-host-to-Linux SSH tunnel is needed for monitoring.
- The dashboard config controls the token through `dashboard.agent_token`.

Operational check from the jump host:

```powershell
Invoke-WebRequest -UseBasicParsing -Headers @{ 'X-Agent-Token' = 'suzuki-lab' } http://192.168.2.143:18180/status
```
