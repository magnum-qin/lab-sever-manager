#!/usr/bin/env bash
set -u

USER_DISK_CACHE="${TMPDIR:-/tmp}/gpu_status_user_disk.cache"
USER_DISK_TTL="${USER_DISK_TTL:-300}"

echo __HOST__
hostname

echo __GPU__
timeout 5s nvidia-smi --query-gpu=index,name,memory.used,memory.total,utilization.gpu,utilization.memory,temperature.gpu --format=csv,noheader,nounits 2>/dev/null || true

echo __GPU_PROC__
timeout 5s nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader,nounits 2>/dev/null || true

echo __MEM__
free -m | awk 'NR==2{print $2","$3","$7}'

echo __DISK__
df -BM -x tmpfs -x devtmpfs -x squashfs --output=source,target,size,used,avail,pcent 2>/dev/null | awk 'NR>1{gsub(/M$/,"",$3);gsub(/M$/,"",$4);gsub(/M$/,"",$5);gsub(/%$/,"",$6);print $1","$2","$3","$4","$5","$6}'

echo __USER_DISK__
now=$(date +%s)
cache_mtime=0
if [ -f "$USER_DISK_CACHE" ]; then
  cache_mtime=$(stat -c %Y "$USER_DISK_CACHE" 2>/dev/null || echo 0)
fi
if [ ! -f "$USER_DISK_CACHE" ] || [ $((now - cache_mtime)) -ge "$USER_DISK_TTL" ]; then
  tmp_cache="$USER_DISK_CACHE.$$"
  timeout 5s sh -c 'du -sm /home/* 2>/dev/null | sort -nr | head -40 | awk "{n=\$2; sub(\"/home/\",\"\",n); print n \",\" \$1}"' > "$tmp_cache" 2>/dev/null
  if [ -s "$tmp_cache" ]; then
    mv "$tmp_cache" "$USER_DISK_CACHE"
  else
    rm -f "$tmp_cache"
  fi
fi
cat "$USER_DISK_CACHE" 2>/dev/null || true

echo __LOAD__
awk '{print $1","$2","$3}' /proc/loadavg | tr -d '\n'
printf ','
nproc
printf '\n'

echo __CPU__
read -r u1 n1 s1 i1 w1 irq1 sirq1 steal1 _ < <(awk '/^cpu /{for(i=2;i<=NF;i++) printf "%s ", $i; print ""}' /proc/stat)
idle1=$((i1 + w1))
nonidle1=$((u1 + n1 + s1 + irq1 + sirq1 + steal1))
total1=$((idle1 + nonidle1))
sleep 0.2
read -r u2 n2 s2 i2 w2 irq2 sirq2 steal2 _ < <(awk '/^cpu /{for(i=2;i<=NF;i++) printf "%s ", $i; print ""}' /proc/stat)
idle2=$((i2 + w2))
nonidle2=$((u2 + n2 + s2 + irq2 + sirq2 + steal2))
total2=$((idle2 + nonidle2))
total_delta=$((total2 - total1))
idle_delta=$((idle2 - idle1))
awk -v total="$total_delta" -v idle="$idle_delta" 'BEGIN{if(total>0){printf "%.1f\n", (total-idle)*100/total}else{print "0.0"}}'

echo __TOP__
ps -eo pid,user,pcpu,pmem,rss,comm,args --sort=-pcpu | awk 'NR>1 && NR<=16 {print}'


