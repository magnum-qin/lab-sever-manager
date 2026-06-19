export type GPU = {
  index: number;
  name: string;
  mem_used_mb: number;
  mem_total_mb: number;
  util_gpu: number;
  util_mem: number;
  temp_c: number;
};

export type Memory = {
  total_mb: number;
  used_mb: number;
  available_mb: number;
};

export type CPU = {
  load1: number;
  load5: number;
  load15: number;
  cpus: number;
  util_pct?: number;
};

export type Disk = {
  source: string;
  target: string;
  size_mb: number;
  used_mb: number;
  available_mb: number;
  use_pct: number;
};

export type UserDisk = {
  user: string;
  used_mb: number;
};

export type ProcessInfo = {
  pid: string;
  user?: string;
  cpu?: string;
  mem?: string;
  rss_kb?: string;
  comm?: string;
  cmd?: string;
  process?: string;
  gpu_mem_mb?: number;
};

export type Alert = {
  level: 'warning' | 'critical' | string;
  message: string;
};

export type LoginInfo = {
  user: string;
  tty: string;
  host: string;
  time: string;
};

export type HostStatus = {
  name: string;
  ip: string;
  group: string;
  port: number;
  error?: string;
  agent_reachable: boolean;
  gpu?: GPU;
  gpus?: GPU[];
  memory?: Memory;
  cpu?: CPU;
  disks: Disk[];
  user_disk: UserDisk[];
  user_tmp_disk: UserDisk[];
  logins: LoginInfo[];
  processes: ProcessInfo[];
  state: 'idle' | 'busy' | 'down' | string;
  alerts: Alert[];
  history?: {
    cpu: number[];
    gpu: number[];
  };
};

export type StatusResponse = {
  timestamp: number;
  poll_seconds: number;
  summary: {
    total: number;
    online: number;
    busy: number;
    down: number;
    warnings: number;
  };
  hosts: HostStatus[];
};

