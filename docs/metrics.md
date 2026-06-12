# Metrics

The Linux Go agent serves live probe output on `127.0.0.1:18180/status`. The dashboard parses these sections:

- `__GPU__`: GPU model, VRAM, utilization, memory-controller utilization, and temperature from `nvidia-smi`.
- `__GPU_PROC__`: GPU compute process PID, command, and GPU memory from `nvidia-smi`.
- `__MEM__`: system memory from `free -m`.
- `__DISK__`: mounted disk volume size, used space, available space, and percent used from `df`.
- `__USER_DISK__`: `/home/<user>` usage from `du -sm /home/*`, cached for 5 minutes on each host.
- `__LOAD__`: 1/5/15 minute load and CPU count from `/proc/loadavg` and `nproc`.
- `__CPU__`: short-window CPU utilization from `/proc/stat`.
- `__TOP__`: top CPU processes from `ps`.

Per-user disk usage is intentionally cached because full `du` scans every 2 seconds would add unnecessary filesystem load on shared servers.
