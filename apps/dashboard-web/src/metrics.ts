import type { HostStatus, ProcessInfo, UserDisk } from './types';

export function pct(used = 0, total = 0) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, (used * 100) / total));
}

export function cpuPct(host: HostStatus) {
  if (!host.cpu) return 0;
  if (typeof host.cpu.util_pct === 'number') return Math.round(host.cpu.util_pct);
  if (!host.cpu.cpus) return 0;
  return Math.round(Math.max(0, Math.min(100, (host.cpu.load1 / host.cpu.cpus) * 100)));
}

export function memoryPct(host: HostStatus) {
  return Math.round(pct(host.memory?.used_mb, host.memory?.total_mb));
}

export function vramPct(host: HostStatus) {
  return Math.round(pct(host.gpu?.mem_used_mb, host.gpu?.mem_total_mb));
}

export function rootDisk(host: HostStatus) {
  return host.disks.find((disk) => disk.target === '/') ?? host.disks[0];
}

export function mb(value = 0) {
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} TB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`;
  return `${Math.round(value)} MB`;
}
const systemUsers = new Set([
  'root', 'nobody', 'dbus', 'messagebus', 'sshd', 'daemon', 'bin', 'sys', 'sync',
  'games', 'man', 'lp', 'mail', 'news', 'uucp', 'proxy', 'www-data', 'backup',
  'list', 'irc', 'gnats', 'uuidd', 'colord', 'dnsmasq', 'lightdm', 'rtkit',
  'pulse', 'avahi', 'usbmux', 'systemd-coredump', 'systemd-timesync',
  'systemd-network', 'systemd-resolve', 'systemd-oom', 'gdm', 'gdm3', 'sddm'
]);

export function isSystemUser(user: string): boolean {
  const u = user.toLowerCase();
  if (systemUsers.has(u)) return true;
  if (u.startsWith('systemd')) return true;
  return false;
}

export function uniqueUsers(host: HostStatus) {
  const users = (host.processes ?? [])
    .map((process) => process.user || 'unknown')
    .filter((user) => !isSystemUser(user));
  return new Set(users).size;
}

export function groupProcesses(host: HostStatus) {
  const diskByUser = new Map<string, UserDisk>();
  for (const entry of host.user_disk ?? []) diskByUser.set(entry.user, entry);
  const groups = new Map<string, ProcessInfo[]>();
  for (const process of host.processes ?? []) {
    const user = process.user || 'unknown';
    if (isSystemUser(user)) continue;
    const group = groups.get(user) ?? [];
    group.push(process);
    groups.set(user, group);
  }
  return [...groups.entries()].map(([user, processes]) => ({
    user,
    processes,
    disk: diskByUser.get(user),
    cpu: processes.reduce((sum, process) => sum + Number(process.cpu || 0), 0),
    mem: processes.reduce((sum, process) => sum + Number(process.mem || 0), 0),
    gpuMem: processes.reduce((sum, process) => sum + Number(process.gpu_mem_mb || 0), 0)
  }));
}

export function rowSignature(host: HostStatus) {
  return JSON.stringify({
    state: host.state,
    error: host.error,
    cpu: cpuPct(host),
    mem: memoryPct(host),
    gpu: host.gpu?.util_gpu ?? 0,
    vram: vramPct(host),
    disk: rootDisk(host)?.use_pct ?? 0,
    users: uniqueUsers(host),
    alerts: (host.alerts ?? []).length
  });
}

