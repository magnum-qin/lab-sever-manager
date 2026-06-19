#!/usr/bin/env bash
set -euo pipefail

USER_DISK_CACHE="${TMPDIR:-/tmp}/gpu_status_user_disk.cache"
USER_TMP_CACHE="${TMPDIR:-/tmp}/gpu_status_user_tmp_disk.cache"
USER_DISK_LOCK="${TMPDIR:-/tmp}/gpu_status_user_disk.lock"
USER_DISK_INTERVAL="${USER_DISK_INTERVAL:-300}"

refresh_once() {
  if ! mkdir "$USER_DISK_LOCK" 2>/dev/null; then
    return
  fi
  trap 'rmdir "$USER_DISK_LOCK" 2>/dev/null || true' RETURN
  
  # 1. Update /home user space cache
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

  # 2. Update /tmp user space cache
  tmp_tmp_cache="$USER_TMP_CACHE.$$"
  find /tmp -xdev -printf "%u %s\n" 2>/dev/null |
    nice -n 19 ionice -c 3 awk '{a[$1]+=$2}END{for(i in a) { mb=int(a[i]/1024/1024); if(mb>0) print i "," mb }}' |
    sort -rn -t, -k2 > "$tmp_tmp_cache" 2>/dev/null || true
  if [ -s "$tmp_tmp_cache" ]; then
    mv "$tmp_tmp_cache" "$USER_TMP_CACHE"
  else
    rm -f "$tmp_tmp_cache"
  fi
}

now=$(date +%s)
mtime=0
if [ -f "$USER_DISK_CACHE" ]; then
  mtime=$(stat -c %Y "$USER_DISK_CACHE" 2>/dev/null || echo 0)
fi

delay=$((USER_DISK_INTERVAL - (now - mtime)))
if [ $delay -le 0 ] 2>/dev/null || [ $((now - mtime)) -ge "$USER_DISK_INTERVAL" ]; then
  refresh_once
else
  sleep $delay
fi

while true; do
  refresh_once
  sleep "$USER_DISK_INTERVAL"
done
