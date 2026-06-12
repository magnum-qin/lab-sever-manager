# Metrics

The Linux Go agent serves live probe output on `0.0.0.0:18180/status` and requires `X-Agent-Token`.

The dashboard parses these sections:

- `__GPU__`: GPU model, VRAM, utilization, memory-controller utilization, and temperature from `nvidia-smi`.
- `__GPU_PROC__`: GPU compute process PID, command, and GPU memory from `nvidia-smi`.
- `__MEM__`: system memory from `free -m`.
- `__DISK__`: mounted disk volume size, used space, available space, and percent used from `df`.
- `__USER_DISK__`: cached `/home/<user>` usage.
- `__LOAD__`: 1/5/15 minute load and CPU count from `/proc/loadavg` and `nproc`.
- `__CPU__`: short-window CPU utilization from `/proc/stat`.
- `__TOP__`: top CPU processes from `ps`, excluding the monitor's own home-usage `du` scan.

Per-user disk usage is not calculated inside the `/status` request path. A separate low-priority background updater refreshes `/tmp/gpu_status_user_disk.cache` every 5 minutes with `nice -n 19` and `ionice -c 3`. The dashboard request only reads that cache, so browser refreshes do not spawn `du` scans.
