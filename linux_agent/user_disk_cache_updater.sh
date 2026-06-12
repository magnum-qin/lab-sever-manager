#!/usr/bin/env bash
set -euo pipefail

USER_DISK_CACHE="${TMPDIR:-/tmp}/gpu_status_user_disk.cache"
USER_DISK_LOCK="${TMPDIR:-/tmp}/gpu_status_user_disk.lock"
USER_DISK_INTERVAL="${USER_DISK_INTERVAL:-300}"

refresh_once() {
  if ! mkdir "$USER_DISK_LOCK" 2>/dev/null; then
    return
  fi
  trap 'rmdir "$USER_DISK_LOCK" 2>/dev/null || true' RETURN
  tmp_cache="$USER_DISK_CACHE.$$"
  find /home -mindepth 1 -maxdepth 1 -xdev -type d -print0 2>/dev/null |
    nice -n 19 ionice -c 3 xargs -0 -r du -sm 2>/dev/null |
    sort -nr | head -40 |
    awk '{n=$2; sub("/home/","",n); print n "," $1}' > "$tmp_cache" 2>/dev/null || true
  if [ -s "$tmp_cache" ]; then
    mv "$tmp_cache" "$USER_DISK_CACHE"
  else
    rm -f "$tmp_cache"
  fi
}

if [ -f "$USER_DISK_CACHE" ]; then
  sleep "$USER_DISK_INTERVAL"
fi

while true; do
  refresh_once
  sleep "$USER_DISK_INTERVAL"
done
