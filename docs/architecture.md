# Dashboard Architecture

The dashboard is split into a Go API and a React/Vite frontend.

## Components

- `cmd/dashboard-api`: Windows jump-host service. It reads `config/hosts.json`, pulls every Linux agent concurrently, parses probe sections, derives host state and alerts, exposes `/api/status`, and serves `apps/dashboard-web/dist`.
- `apps/dashboard-web`: React + TypeScript frontend. It polls `/api/status`, keeps host rows stable, highlights changed cells, and uses progressive disclosure for per-host details.
- `cmd/gpu-status-agent`: Linux host agent. It executes `linux_agent/dashboard_probe.sh` and protects `/status` with `X-Agent-Token` when configured.

## API Endpoints

- `GET /health`: liveness check.
- `GET /api/status`: latest live status for all configured hosts.
- `GET /api/events`: server-sent events stream. The frontend currently polls `/api/status`; this endpoint is available for a future push-based UI.

## Frontend Stack

- Vite 8
- React 18.3, pinned for compatibility with the stable Tremor package
- TypeScript
- Tailwind CSS v4 plugin
- Framer Motion for row/detail transitions
- Lucide icons
- TanStack Table dependency reserved for richer process tables
- Tremor dependency reserved for future historical charts

## Runtime Model

The Windows dashboard process does not need SSH tunnels. It connects directly to each Linux host on port `18180` over the lab LAN and sends the configured `X-Agent-Token` header.

The Linux status request path is intentionally cheap. Heavy per-user disk scans run in `user_disk_cache_updater.sh` at low priority and write `/tmp/gpu_status_user_disk.cache`; `dashboard_probe.sh` reads that cache when it is fresh.

## Host State Semantics

`down` means the dashboard API could not reach the Linux agent or the agent returned an HTTP error. GPU collection failures are not treated as host downtime: when the agent is reachable but `nvidia-smi`/NVML fails, the host remains online with a warning such as `GPU metrics unavailable; check NVIDIA driver/NVML`, and non-GPU metrics continue to display.
