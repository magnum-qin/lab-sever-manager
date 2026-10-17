import { Server, Activity, HardDrive, Cpu, MemoryStick as Memory, ExternalLink, RefreshCw, AlertTriangle, Play, Square, Globe, Layers, X, Brain, Download, Trash2, Shield, Search, Plus, Users, Clock, Database, Copy, Terminal, Check, Info } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { HostStatus } from '../types';
import { cpuPct, groupProcesses, mb, memoryPct, pct, rootDisk, uniqueUsers, vramPct } from '../metrics';
import { MetricCell, StatusPill, Card, ProgressMetric, LineChart } from './Primitives';

type HostCardsGridProps = {
  hosts: HostStatus[];
  selectedHost: string;
  onSelect: (name: string) => void;
};

const userColors = [
  ['bg-blue-50/40 border-blue-100', 'bg-blue-600'],
  ['bg-emerald-50/40 border-emerald-100', 'bg-emerald-600'],
  ['bg-amber-50/40 border-amber-100', 'bg-amber-600'],
  ['bg-purple-50/40 border-purple-100', 'bg-purple-600'],
  ['bg-rose-50/40 border-rose-100', 'bg-rose-600'],
  ['bg-cyan-50/40 border-cyan-100', 'bg-cyan-600']
];

function colorFor(user: string) {
  let hash = 0;
  for (const char of user) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return userColors[Math.abs(hash) % userColors.length];
}

// 1. Grid of Compact Server Cards
export function HostCardsGrid({ hosts, selectedHost, onSelect }: HostCardsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {hosts.map((host) => {
        const active = host.name === selectedHost;
        const isDown = host.state === 'down';
        const cPct = cpuPct(host);
        const gPct = host.gpu ? host.gpu.util_gpu : 0;
        const uCount = uniqueUsers(host) || 0;

        return (
          <div
            key={host.name}
            onClick={() => onSelect(host.name)}
            className={`rounded-xl border p-4 cursor-pointer shadow-sm flex flex-col justify-between h-[102px] transition-all duration-200 select-none ${
              active
                ? 'border-indigo-650 ring-2 ring-indigo-500/20 bg-indigo-50/15'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
            }`}
          >
            {/* Header info */}
            <div className="flex justify-between items-start gap-2">
              <div className="min-w-0">
                <span className="font-bold text-slate-800 text-sm block leading-tight truncate">{host.name}</span>
                <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 truncate">
                  {host.group} • {host.ip}
                </span>
              </div>
              <span className={`h-2 w-2 rounded-full shrink-0 mt-1 ${
                host.state === 'idle' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : host.state === 'busy' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
              }`} />
            </div>

            {/* Bottom brief stats */}
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 font-mono pt-1.5 border-t border-slate-100 mt-1">
              {isDown ? (
                <span className="text-rose-500 font-semibold uppercase tracking-wider truncate">
                  {host.error || 'unreachable'}
                </span>
              ) : (
                <>
                  <span>CPU: <strong className="text-slate-800">{cPct}%</strong></span>
                  <span>GPU: <strong className="text-slate-800">{gPct}%</strong></span>
                  <span>Users: <strong className="text-slate-800">{uCount}</strong></span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type HostDetailsViewProps = {
  host: HostStatus;
  cpuHistory: number[];
  gpuHistory: number[];
  pollSeconds?: number;
  onSelectAlertsTab?: () => void;
};

// 2. Comprehensive Spacious Selected Server Details View
export function HostDetailsView({ host, cpuHistory, gpuHistory, pollSeconds = 2, onSelectAlertsTab }: HostDetailsViewProps) {
  const [isUnslothModalOpen, setIsUnslothModalOpen] = useState(false);
  const groups = groupProcesses(host);
  const isDown = host.state === 'down';

  useEffect(() => {
    setIsUnslothModalOpen(false);
  }, [host.name]);

  return (
    <div className="space-y-6">
      {/* Selected Host Header Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
            <Server size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">{host.name}</h2>
              <span className={`h-2 w-2 rounded-full ${isDown ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Cluster Group: <strong className="text-slate-600">{host.group}</strong> • Host Address: <strong className="text-slate-600">{host.ip}:{host.port}</strong>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <StatusPill state={host.state} />
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-3.5 py-1.5 shadow-sm select-none">
            <Users size={12} className="text-slate-400" />
            <span>{uniqueUsers(host) || 0} Logged In</span>
          </div>
          {host.alerts && host.alerts.length > 0 && (
            <div 
              onClick={onSelectAlertsTab}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-4 py-1.5 shadow-sm cursor-default transition-colors hover:bg-rose-100"
              title={host.alerts.map((a: any) => a.message).join('\n')}
            >
              <AlertTriangle size={14} className="text-rose-500 animate-pulse" />
              <span>{host.alerts.length} Active Warning{host.alerts.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Primary Metrics Grid (Occupancy progress bars + sparkline trends) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Resource Workloads (占用图, 1 col) */}
        <Card className="lg:col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Resource Workloads</h3>
            <p className="text-xs text-slate-400 mt-0.5">Current system allocations.</p>
          </div>
          <div className="space-y-3.5 mt-5">
            {host.cpu ? (
              <ProgressMetric
                label="CPU Load"
                value={`${cpuPct(host)}%`}
                percent={cpuPct(host)}
                caption={`load ${host.cpu.load1.toFixed(2)} / ${host.cpu.cpus} cores`}
              />
            ) : (
              <span className="text-xs text-rose-500 font-semibold italic block">Host unreachable.</span>
            )}
            {host.memory && (
              <ProgressMetric
                label="System Memory"
                value={`${memoryPct(host)}%`}
                percent={memoryPct(host)}
                caption={`${mb(host.memory.used_mb)} / ${mb(host.memory.total_mb)}`}
              />
            )}
            {rootDisk(host) && (
              <ProgressMetric
                label="Root Disk"
                value={`${rootDisk(host)?.use_pct ?? 0}%`}
                percent={rootDisk(host)?.use_pct ?? 0}
                caption={`${mb(rootDisk(host)?.used_mb)} / ${mb(rootDisk(host)?.size_mb)}`}
              />
            )}
            {host.gpus && host.gpus.length > 0 ? (
              host.gpus.map((gpu) => {
                const labelPrefix = host.gpus!.length > 1 ? `GPU ${gpu.index} ` : '';
                const vramPercent = Math.round(pct(gpu.mem_used_mb, gpu.mem_total_mb));
                return (
                  <React.Fragment key={gpu.index}>
                    <ProgressMetric
                      label={`${labelPrefix}Utility`}
                      value={`${gpu.util_gpu}%`}
                      percent={gpu.util_gpu}
                      caption={`${gpu.name.replace('NVIDIA GeForce ', '')} • ${gpu.temp_c}°C`}
                    />
                    <ProgressMetric
                      label={`${labelPrefix}VRAM`}
                      value={`${vramPercent}%`}
                      percent={vramPercent}
                      caption={`${mb(gpu.mem_used_mb)} / ${mb(gpu.mem_total_mb)}`}
                    />
                  </React.Fragment>
                );
              })
            ) : host.gpu ? (
              <>
                <ProgressMetric
                  label="GPU Utility"
                  value={`${host.gpu.util_gpu}%`}
                  percent={host.gpu.util_gpu}
                  caption={`${host.gpu.name.replace('NVIDIA GeForce ', '')} • ${host.gpu.temp_c}°C`}
                />
                <ProgressMetric
                  label="VRAM Allocation"
                  value={`${vramPct(host)}%`}
                  percent={vramPct(host)}
                  caption={`${mb(host.gpu.mem_used_mb)} / ${mb(host.gpu.mem_total_mb)}`}
                />
              </>
            ) : (
              <div className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-xl flex items-center justify-between text-xs text-amber-900 mt-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="font-bold">GPU Metrics Unavailable</span>
                </div>
                <span className="text-[10px] text-amber-700 font-semibold font-mono">Driver/NVML Issue</span>
              </div>
            )}
          </div>
        </Card>

        {/* Real-time Workload History (折线图, 2 cols) */}
        <Card className="lg:col-span-2 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Real-time Workload History</h3>
            <p className="text-xs text-slate-400 mt-0.5">Polling metrics trend logs over time.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 flex-1">
            {/* CPU Trend line */}
            <div className="flex flex-col p-4 border border-slate-100 rounded-xl bg-slate-50/50 h-full">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">CPU Load History</span>
                <strong className="text-xl font-bold text-indigo-650 block mt-1">
                  {host.cpu ? `${cpuPct(host)}%` : '-'}
                </strong>
              </div>
              <div className="flex-1 min-h-[120px] mt-3 relative">
                <LineChart points={cpuHistory} strokeColor="#4f46e5" pollSeconds={pollSeconds} />
              </div>
            </div>
            {/* GPU Trend line */}
            <div className="flex flex-col p-4 border border-slate-100 rounded-xl bg-slate-50/50 h-full">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">GPU Load History</span>
                <strong className="text-xl font-bold text-violet-600 block mt-1">
                  {host.gpu ? `${host.gpu.util_gpu}%` : '-'}
                </strong>
              </div>
              <div className="flex-1 min-h-[120px] mt-3 relative">
                <LineChart points={gpuHistory} strokeColor="#8b5cf6" pollSeconds={pollSeconds} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Secondary Information Grid (Disk volumes and User spaces, Logins, Alerts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Disk Volumes & User Spaces Card */}
        <Card className="flex flex-col h-[350px] bg-white border-slate-200">
          {(() => {
            const homeDisk = (host.disks ?? []).find(d => d.target === '/home') || (host.disks ?? []).find(d => d.target === '/');
            
            return (
              <>
                <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm mb-3">
                  <HardDrive size={15} className="text-indigo-600" />
                  <span>Disk Volumes & User Spaces</span>
                </div>
                
                {/* /home space progress bar at the top */}
                {homeDisk && (
                  <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-indigo-650 font-bold">{homeDisk.target}</span>
                        <span className="text-slate-400 font-normal">Usage</span>
                      </div>
                      <span className="font-mono font-bold text-slate-800">
                        {homeDisk.use_pct}% <span className="text-slate-400 font-normal">({mb(homeDisk.used_mb)} / {mb(homeDisk.size_mb)})</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          homeDisk.use_pct >= 90 ? 'bg-rose-500' : homeDisk.use_pct >= 75 ? 'bg-amber-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${homeDisk.use_pct}%` }}
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex flex-col min-w-0 min-h-0 flex-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">User Directories (under /home)</span>
                  <div className="space-y-1 overflow-y-auto flex-1 min-h-0 pr-1 divide-y divide-slate-100">
                    {(host.user_disk ?? []).length ? (
                      (host.user_disk ?? []).map((entry, i) => (
                        <div className="flex justify-between items-center gap-2 py-2 text-xs" key={i}>
                          <span className="text-slate-600 font-semibold font-mono truncate min-w-0">/home/{entry.user}</span>
                          <span className="text-slate-800 font-bold font-mono shrink-0">{mb(entry.used_mb)}</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 italic block py-1">No user home space reports.</span>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </Card>

        {/* User Login History Card */}
        <Card className="flex flex-col h-[350px] bg-white border-slate-200">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm mb-3">
            <Users size={15} className="text-indigo-650" />
            <span>Login History</span>
          </div>
          <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
            {(host.logins ?? []).length ? (
              (host.logins ?? []).map((login, i) => {
                const isOnline = login.time.includes('still logged in');
                return (
                  <div className="flex flex-col border-b border-slate-100 pb-1.5 last:border-0" key={i}>
                    <div className="flex justify-between items-center gap-2 font-semibold text-slate-700 text-sm">
                      <span className="font-mono text-indigo-600 flex items-center gap-1.5 min-w-0 truncate">
                        {isOnline && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
                        <span className="truncate">{login.user}</span>
                      </span>
                      <span className="text-xs text-slate-400 font-normal shrink-0">{login.tty}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="truncate min-w-0 flex-1 text-slate-450" title={login.host}>{login.host}</span>
                      <span className={`shrink-0 font-mono text-[10px] ${isOnline ? 'text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100' : ''}`}>
                        {isOnline ? 'online' : login.time}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <span className="text-xs text-slate-400 italic block">No login logs available.</span>
            )}
          </div>
        </Card>

        {/* Unsloth Studio Inline Card */}
        <UnslothManagerCard host={host} />
      </div>

      {/* User Processes Card Panels Grid */}
      <UserProcessesSection host={host} groups={groups} />

      {/* Unsloth Manager Modal Dialog */}
    </div>
  );
}


interface UnslothStatus {
  installed: boolean;
  running: boolean;
  vram_used_mb: number;
  timeout_minutes: number;
  active_model?: string;
}

function UnslothManagerCard({ host }: { host: any }) {
  const hostName = host.name;
  const hostState = host.state;
  const totalVramMb = React.useMemo(() => {
    if (host.gpus && host.gpus.length > 0) return host.gpus.reduce((sum: number, g: any) => sum + g.mem_total_mb, 0);
    return host.gpu ? host.gpu.mem_total_mb : 1;
  }, [host]);
  
  const [status, setStatus] = React.useState<UnslothStatus | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [timeoutMin, setTimeoutMin] = React.useState("0");
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [proxy, setProxy] = React.useState<any>(null);
  const [showModelsModal, setShowModelsModal] = React.useState(false);
  
  const loadStatus = async () => {
    if (hostState === 'down') return;
    setLoading(true);
    try {
      const res = await fetch(`/api/unsloth/status?host=${hostName}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setTimeoutMin(data.timeout_minutes.toString());
      }
      const proxyRes = await fetch('/api/portproxy');
      if (proxyRes.ok) {
        const proxies = await proxyRes.json();
        const myProxy = proxies.find((p: any) => p.connect_address === host.ip && p.connect_port === 8888);
        setProxy(myProxy || null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadStatus();
  }, [hostName, hostState]);

  const handleAction = async (action: string, extraParams: string = "") => {
    try {
      const res = await fetch(`/api/unsloth/control?host=${hostName}&action=${action}${extraParams}`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      await loadStatus();
      if (action === 'set_timeout') {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (e) {
      alert(`操作失败: ${e}`);
    }
  };

  const handleProxyToggle = async () => {
    try {
      setLoading(true);
      if (proxy) {
        await fetch('/api/portproxy/delete', {
          method: 'POST',
          body: JSON.stringify({ listen_address: proxy.listen_address, listen_port: proxy.listen_port })
        });
      } else {
        const proxyRes = await fetch('/api/portproxy');
        let availablePort = 11441;
        if (proxyRes.ok) {
          const proxies = await proxyRes.json();
          const unslothProxies = proxies.filter((p: any) => p.connect_port === 8888);
          const usedPorts = new Set(unslothProxies.map((p: any) => p.listen_port));
          for (let p = 11441; p <= 11448; p++) {
            if (!usedPorts.has(p)) {
              availablePort = p;
              break;
            }
          }
        }
        await fetch('/api/portproxy/add', {
          method: 'POST',
          body: JSON.stringify({ listen_address: '0.0.0.0', listen_port: availablePort, connect_address: host.ip, connect_port: 8888 })
        });
      }
      await loadStatus();
    } catch (e) {
      alert(`代理操作失败: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !status) {
    return (
      <Card className="flex flex-col h-[350px] bg-white border-slate-200">
         <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm mb-3">
            <Brain size={15} className="text-indigo-600" />
            <span>Unsloth Studio</span>
          </div>
         <div className="text-center text-slate-400 text-sm mt-10">Loading engine state...</div>
      </Card>
    );
  }

  if (!status) {
    return (
      <Card className="flex flex-col h-[350px] bg-white border-slate-200">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm mb-3">
            <Brain size={15} className="text-indigo-600" />
            <span>Unsloth Studio</span>
          </div>
          <div className="text-center flex flex-col items-center gap-2 mt-6">
            <X className="text-rose-400 w-6 h-6" />
            <p className="text-xs text-slate-500">Node unreachable</p>
            <button onClick={loadStatus} className="mt-2 text-[10px] px-3 py-1 bg-slate-50 border border-slate-200 text-slate-600 font-bold rounded hover:bg-slate-100 transition-colors">
              Retry
            </button>
          </div>
      </Card>
    );
  }

  if (!status.installed) {
    return (
      <Card className="flex flex-col h-[350px] bg-white border-slate-200">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm mb-3">
            <Brain size={15} className="text-indigo-600" />
            <span>Unsloth Studio</span>
          </div>
          <div className="text-center flex flex-col items-center justify-center h-full pb-8">
            <Brain className="text-slate-200 w-10 h-10 mb-3" />
            <p className="text-[11px] text-slate-400 max-w-[180px]">Environment not installed</p>
          </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-[350px] bg-white border-slate-200">
      <div className="flex justify-between items-center text-slate-800 font-semibold text-sm mb-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Brain size={15} className="text-indigo-600" />
          <span className="truncate">Unsloth Studio</span>
          {status.running ? (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 ml-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              Active
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-slate-500 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 ml-1">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
              Stopped
            </span>
          )}
        </div>
        <div className="flex items-center ml-2 shrink-0">
          {status.running ? (
            <button onClick={() => handleAction('stop')} className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-100 px-2.5 py-1 rounded transition-colors flex items-center gap-1 shadow-sm">
              <Square size={9} fill="currentColor" /> Stop
            </button>
          ) : (
            <button onClick={() => handleAction('start')} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 px-2.5 py-1 rounded transition-colors flex items-center gap-1 shadow-sm">
              <Play size={9} fill="currentColor" /> Start
            </button>
          )}
        </div>
      </div>

      <div className="space-y-0 overflow-y-auto flex-1 min-h-0 pr-1 pb-1">
        
        

        {/* Running Model */}
        <div className="flex flex-col border-b border-slate-100 py-3 first:pt-0">
          <div className="flex justify-between items-center gap-2 font-semibold text-slate-700 text-sm mb-2">
            <span className="text-xs text-slate-600 flex items-center gap-1.5 min-w-0">
              <Database size={13} className="text-slate-400" />
              Running Model
            </span>
            {status.running && (status.active_model || status.vram_used_mb > 2000) && (
              <button onClick={() => handleAction('unload')} className="text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-0.5 rounded transition-colors shadow-sm">
                Unload Model
              </button>
            )}
          </div>
          
          <div className="mb-1 p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between gap-2 min-w-0">
            <span className="font-mono text-xs font-semibold text-slate-800 truncate" title={
              !status.running ? 'Stopped' : (status.active_model || (status.vram_used_mb > 2000 ? 'Loaded Model' : 'No model loaded'))
            }>
              {!status.running ? 'Stopped' : (status.active_model || (status.vram_used_mb > 2000 ? 'Loaded Model' : 'No model loaded'))}
            </span>
            {status.running && (status.active_model || status.vram_used_mb > 2000) && (
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            )}
          </div>
        </div>

        {/* Network Access */}
        <div className="flex flex-col border-b border-slate-100 py-3">
          <div className="flex justify-between items-center gap-2 font-semibold text-slate-700 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-slate-600 flex items-center gap-1.5 whitespace-nowrap">
                <Globe size={13} className="text-slate-400" />
                Public Proxy
              </span>
              {proxy ? (
                <a 
                  href={`http://100.64.0.1:${proxy.listen_port}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-indigo-600 text-[11px] truncate bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded border border-indigo-100 hover:border-indigo-300 transition-colors cursor-pointer hover:underline"
                >
                  100.64.0.1:{proxy.listen_port}
                </a>
              ) : (
                <span className="text-[10px] text-slate-400">Disabled</span>
              )}
            </div>
            
            <button 
              onClick={handleProxyToggle} 
              disabled={!status.installed}
              className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors shadow-sm border ${
                proxy 
                  ? 'text-rose-600 bg-rose-50 hover:bg-rose-100 border-rose-200' 
                  : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-200 disabled:opacity-50'
              }`}
            >
              {proxy ? 'Disable' : 'Enable'}
            </button>
          </div>
        </div>

        

        {/* Auto-Unload Configuration */}
        <div className="flex flex-col border-b border-slate-100 py-3">
          <div className="flex justify-between items-center gap-2 font-semibold text-slate-700 text-sm">
            <span className="text-xs text-slate-600 flex items-center gap-1.5 min-w-0">
              <Clock size={13} className="text-slate-400" />
              Auto-Unload (mins)
            </span>
            <div className="flex items-center gap-1.5">
              <input 
                type="number" 
                value={timeoutMin} 
                onChange={e => setTimeoutMin(e.target.value)}
                className="w-10 px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 text-center shadow-inner"
                min="0"
              />
              <button 
                onClick={() => handleAction('set_timeout', `&minutes=${timeoutMin}`)} 
                className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors shadow-sm border ${
                  saveSuccess 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                }`}
              >
                {saveSuccess ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>
        </div>

        {/* Downloaded Models */}
        <div className="flex flex-col py-3">
          <button 
            onClick={() => setShowModelsModal(true)}
            disabled={!status.installed}
            className="flex justify-center items-center gap-2 font-semibold text-slate-600 text-xs w-full py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors shadow-sm disabled:opacity-50"
          >
            <Layers size={13} className="text-slate-400" />
            View Downloaded Models
          </button>
        </div>

      </div>
      <ModelsModal host={host} isOpen={showModelsModal} onClose={() => setShowModelsModal(false)} />
    </Card>
  );
}


function ModelsModal({ host, isOpen, onClose }: { host: any, isOpen: boolean, onClose: () => void }) {
  const [models, setModels] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError('');
      fetch(`/api/unsloth/models?host=${host.name}`)
        .then(async res => {
          if (!res.ok) throw new Error(await res.text());
          return res.json();
        })
        .then(data => {
          setModels(data.data || data.models || data || []);
        })
        .catch(err => setError(err.toString()))
        .finally(() => setLoading(false));
    }
  }, [isOpen, host.name]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 bg-slate-50 border-b border-slate-100 shrink-0">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Layers size={16} className="text-indigo-600" />
                Models on {host.name}
              </h2>
              <button onClick={onClose} className="p-1.5 bg-slate-100 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                <X size={14} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
                  <span className="text-xs">Fetching downloaded models...</span>
                </div>
              ) : error ? (
                <div className="text-center py-10">
                  <div className="inline-flex items-center gap-2 text-rose-600 bg-rose-50 px-4 py-2 rounded-lg border border-rose-100 text-xs">
                    <X size={14} />
                    {error}
                  </div>
                </div>
              ) : models.length > 0 ? (
                <div className="space-y-3">
                  {models.map((m, i) => {
                    const idParts = (m.id || '').split('/');
                    const modelName = idParts.pop() || 'Unknown Model';
                    const orgName = idParts.join('/') || 'Local';
                    const sizeGb = m.size ? Math.round((m.size/1024/1024/1024)*10)/10 : 0;
                    
                    return (
                      <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                        <div className="flex flex-col min-w-0 pr-4">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{orgName}</span>
                          <span className="font-semibold text-slate-700 text-sm truncate mt-0.5" title={m.id}>{modelName}</span>
                          {sizeGb > 0 && <span className="text-[11px] text-slate-500 mt-1 flex items-center gap-1"><HardDrive size={10} /> {sizeGb} GB</span>}
                        </div>
                        <div className="shrink-0">
                          {m.quantization ? (
                            <span className="text-[10px] font-bold px-2 py-1 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">
                              {m.quantization.toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-1 bg-slate-50 text-slate-500 rounded border border-slate-200">
                              FP16
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 flex flex-col items-center">
                  <Layers className="text-slate-200 w-12 h-12 mb-3" />
                  <span className="text-sm text-slate-400">No models found on this node.</span>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center shrink-0">
              Powered by Unsloth Studio
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


function UserProcessesSection({ host, groups }: { host: any, groups: any[] }) {
  const [selectedUser, setSelectedUser] = React.useState<string | null>(null);

  const highestUser = React.useMemo(() => {
    if (!groups || groups.length === 0) return null;
    return groups.reduce((prev, current) => {
      const prevScore = (prev.gpuMem * 1000) + prev.cpu;
      const currScore = (current.gpuMem * 1000) + current.cpu;
      return (currScore > prevScore) ? current : prev;
    }).user;
  }, [groups]);

  const activeUser = selectedUser || highestUser;
  const activeGroup = groups.find(g => g.user === activeUser);

  if (!groups || groups.length === 0) {
    return (
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
          Active Processes by User
        </h4>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2 text-slate-400 text-xs py-4 pl-1"
        >
          <Server size={14} />
          <span>No active user processes reported on this server.</span>
        </motion.div>
      </div>
    );
  }

  const totalGpuMem = host.gpus && host.gpus.length > 0 
    ? host.gpus.reduce((sum: number, g: any) => sum + g.mem_total_mb, 0)
    : (host.gpu ? host.gpu.mem_total_mb : 0);
  const isGpuIdle = host.gpus && host.gpus.length > 0 
    ? host.gpus.every((g: any) => g.util_gpu === 0) 
    : (host.gpu ? host.gpu.util_gpu === 0 : false);

  const getResourceColor = (val: number) => {
    if (val >= 80) return 'text-rose-500 font-bold';
    if (val >= 50) return 'text-amber-500 font-bold';
    return 'text-slate-500';
  };

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
        Active Processes by User
      </h4>
      
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left column: User List */}
        <div className="w-full lg:w-[35%] flex flex-col gap-2">
          {groups.map(({ user, processes, disk, cpu, mem, gpuMem }) => {
            const [containerClass, dotClass] = colorFor(user);
            const gpuMemPct = totalGpuMem > 0 ? (gpuMem / totalGpuMem) * 100 : 0;
            const isActive = activeUser === user;

            return (
              <div
                key={user}
                onClick={() => setSelectedUser(user)}
                className={`cursor-pointer rounded-xl border shadow-sm p-3.5 flex flex-col transition-all duration-200 ${
                  isActive ? 'border-indigo-400 bg-indigo-50/30 ring-1 ring-indigo-400/50 scale-[1.02]' : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${isActive ? 'bg-indigo-500 animate-pulse' : dotClass}`} />
                    <span className={`font-bold text-sm ${isActive ? 'text-indigo-800' : 'text-slate-800'}`}>{user}</span>
                  </div>
                  {disk && (
                    <span className="text-[9px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-1 py-0.5 rounded">
                      {mb(disk.used_mb)} home
                    </span>
                  )}
                </div>
                
                <div className="text-[10px] text-slate-500 font-semibold font-mono flex flex-wrap gap-x-2 gap-y-1">
                  <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{processes.length} procs</span>
                  <span className={`bg-slate-100 px-1.5 py-0.5 rounded ${getResourceColor(cpu)}`}>CPU {cpu.toFixed(1)}%</span>
                  <span className={`bg-slate-100 px-1.5 py-0.5 rounded ${getResourceColor(mem)}`}>MEM {mem.toFixed(1)}%</span>
                  <span className={`bg-slate-100 px-1.5 py-0.5 rounded ${getResourceColor(gpuMemPct)}`}>
                    GPU {gpuMemPct.toFixed(1)}% ({gpuMem ? mb(gpuMem) : '0M'})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Right column: Active User Process Details */}
        <div className="w-full lg:w-[65%]">
          <AnimatePresence mode="wait">
            {activeGroup && (
              <motion.div
                key={activeUser}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col h-full min-h-[250px]"
              >
                <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                  <span className="font-bold text-slate-700 text-sm">
                    {activeUser}'s Processes
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                    {activeGroup.processes.length} total
                  </span>
                </div>
                
                <div className="overflow-x-auto w-full flex-1">
                  <table className="w-full text-left text-[11px] border-collapse min-w-[420px]">
                    <thead>
                      <tr className="text-slate-400 font-bold bg-white border-b border-slate-100">
                        <th className="py-2 pl-4 pr-2 font-semibold w-[80px]">PID</th>
                        <th className="py-2 px-2 font-semibold w-[60px]">CPU</th>
                        <th className="py-2 px-2 font-semibold w-[60px]">MEM</th>
                        <th className="py-2 px-2 font-semibold w-[90px]">GPU MEM</th>
                        <th className="py-2 pl-2 pr-4 font-semibold">COMMAND</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {activeGroup.processes.slice(0, 20).map((process: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 pl-4 pr-2 font-mono text-slate-500">{process.pid}</td>
                          <td className="py-2 px-2 text-slate-700">{process.cpu || '0'}%</td>
                          <td className="py-2 px-2 text-slate-700">{process.mem || '0'}%</td>
                          <td className="py-2 px-2 text-slate-700 font-mono">
                            {process.gpu_mem_mb ? (
                              <div className="flex items-center gap-1">
                                <span className="text-indigo-600 font-semibold">{mb(process.gpu_mem_mb)}</span>
                                {isGpuIdle && (
                                  <span
                                    className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                                    title="VRAM is occupied while GPU computation is idle (0%)"
                                  >
                                    VRAM Holder
                                  </span>
                                )}
                              </div>
                            ) : '-'}
                          </td>
                          <td
                            className="py-2 pl-2 pr-4 font-mono text-slate-600 truncate max-w-[200px]"
                            title={process.cmd || process.process}
                          >
                            {process.cmd || process.process || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

type HostWarningDetailsViewProps = {
  host: HostStatus;
  pollSeconds?: number;
};

export function HostWarningDetailsView({ host, pollSeconds = 2 }: HostWarningDetailsViewProps) {
  const isDown = host.state === 'down' || !host.agent_reachable;

  // Compute active alerts
  const activeAlerts = [...(host.alerts || [])];
  if (isDown) {
    const hasConnectionAlert = activeAlerts.some(a => a.message.toLowerCase().includes('unreachable'));
    if (!hasConnectionAlert) {
      activeAlerts.unshift({
        level: 'critical',
        message: `${host.name} agent is unreachable`
      });
    }
  }

  // CPU percent helper
  const cPct = cpuPct(host);
  // Memory percent helper
  const mPct = memoryPct(host);
  // VRAM percent helper
  const vPct = vramPct(host);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Header Panel */}
      <div className="bg-slate-50/70 px-6 py-4.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm shrink-0">
            <Server size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-md font-bold text-slate-800">{host.name}</h2>
              <span className={`h-2 w-2 rounded-full ${isDown ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
              Cluster Group: <strong className="text-slate-600">{host.group}</strong> • Address: <strong className="text-slate-600">{host.ip}:{host.port}</strong>
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <StatusPill state={host.state} />
          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-650 bg-white border border-slate-200 rounded-full px-3 py-1 shadow-sm select-none">
            <Users size={11} className="text-slate-400" />
            <span>{uniqueUsers(host) || 0} Logged In</span>
          </div>
        </div>
      </div>

      {/* Warnings List Content Area */}
      <div className="p-6">
        {activeAlerts.length > 0 ? (
          <div className="space-y-6 divide-y divide-slate-100">
            {activeAlerts.map((alert, i) => {
              const msg = alert.message.toLowerCase();
              const isDiskAlert = msg.includes('disk') && msg.includes('used');
              const isCpuAlert = msg.includes('cpu is');
              const isMemAlert = msg.includes('system memory is');
              const isVramAlert = msg.includes('vram is');
              const isGpuMetricsAlert = msg.includes('gpu metrics unavailable') || msg.includes('nvml');
              const isTempAlert = msg.includes('temperature') || msg.includes('temp');

              return (
                <div 
                  key={i} 
                  className={`space-y-4 ${i > 0 ? 'pt-6' : ''}`}
                >
                  {/* Warning Header */}
                  <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                    <AlertTriangle size={16} className="text-rose-500 animate-pulse shrink-0" />
                    <span>{alert.message}</span>
                  </div>

                  {/* Warning Context Details */}
                  {isDiskAlert && (
                    <div className="space-y-4 pl-6 w-full">
                      {(() => {
                        const match = alert.message.match(/disk\s+(\S+)\s+/i);
                        const diskPath = match ? match[1] : '/home';
                        const targetDisk = host.disks.find(d => d.target === diskPath) || host.disks.find(d => d.target === '/home') || host.disks[0];

                        return (
                          <>
                            {targetDisk && (
                              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl w-full shadow-inner-sm">
                                <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-indigo-650 font-bold">{targetDisk.target}</span>
                                    <span className="text-slate-400 font-normal">Capacity Usage</span>
                                  </div>
                                  <span className="font-mono font-bold text-slate-800">
                                    {targetDisk.use_pct}% <span className="text-slate-400 font-normal">({mb(targetDisk.used_mb)} / {mb(targetDisk.size_mb)})</span>
                                  </span>
                                </div>
                                <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      targetDisk.use_pct >= 90 ? 'bg-rose-500' : targetDisk.use_pct >= 75 ? 'bg-amber-500' : 'bg-indigo-600'
                                    }`}
                                    style={{ width: `${targetDisk.use_pct}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {diskPath === '/home' && (
                              <div className="flex flex-col min-w-0 min-h-0 w-full">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">User Directories (under /home)</span>
                                <div className="border border-slate-200/70 rounded-xl overflow-hidden bg-white shadow-sm w-full">
                                  <div className="divide-y divide-slate-100 px-4 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
                                    {(host.user_disk ?? []).length ? (
                                      (host.user_disk ?? [])
                                        .sort((a, b) => b.used_mb - a.used_mb)
                                        .map((entry, idx) => (
                                          <div className="flex justify-between items-center gap-2 py-2.5 text-xs" key={idx}>
                                            <span className="text-slate-650 font-semibold font-mono truncate min-w-0">/home/{entry.user}</span>
                                            <span className="text-slate-800 font-bold font-mono shrink-0">{mb(entry.used_mb)}</span>
                                          </div>
                                        ))
                                    ) : (
                                      <span className="text-xs text-slate-400 italic block py-3 text-center">No user home space reports.</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {isCpuAlert && (
                    <div className="space-y-4 pl-6 w-full">
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl w-full shadow-inner-sm">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
                          <span className="text-slate-700 font-bold">CPU Usage</span>
                          <span className="font-mono font-bold text-slate-800">{cPct}%</span>
                        </div>
                        <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500 bg-rose-500"
                            style={{ width: `${cPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2 w-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Top CPU Processes</span>
                        <div className="border border-slate-200/70 rounded-xl overflow-hidden bg-white shadow-sm w-full">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                              <tr className="text-slate-405 font-bold border-b border-slate-100 bg-slate-50/50">
                                <th className="py-2 px-3.5 font-semibold w-[80px]">User</th>
                                <th className="py-2 px-2 font-semibold w-[60px]">PID</th>
                                <th className="py-2 px-2 font-semibold w-[60px]">CPU%</th>
                                <th className="py-2 px-2 font-semibold w-[60px]">MEM%</th>
                                <th className="py-2 pl-2 pr-3.5 font-semibold">COMMAND</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(host.processes ?? [])
                                .filter(p => Number(p.cpu || 0) > 0)
                                .sort((a, b) => Number(b.cpu || 0) - Number(a.cpu || 0))
                                .slice(0, 5)
                                .map((p, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                                    <td className="py-2 px-3.5 text-slate-700 font-semibold">{p.user || 'root'}</td>
                                    <td className="py-2 px-2 text-slate-505 font-mono">{p.pid}</td>
                                    <td className="py-2 px-2 text-slate-950 font-bold">{p.cpu}%</td>
                                    <td className="py-2 px-2 text-slate-600">{p.mem}%</td>
                                    <td className="py-2 pl-2 pr-3.5 text-slate-600 font-mono truncate max-w-[300px]" title={p.cmd || p.process}>
                                      {p.cmd || p.process}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {isMemAlert && (
                    <div className="space-y-4 pl-6 w-full">
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl w-full shadow-inner-sm">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
                          <span className="text-slate-700 font-bold">System Memory Usage</span>
                          <span className="font-mono font-bold text-slate-800">{mPct}% ({mb(host.memory?.used_mb)} / {mb(host.memory?.total_mb)})</span>
                        </div>
                        <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500 bg-rose-500"
                            style={{ width: `${mPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2 w-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Top Memory Processes</span>
                        <div className="border border-slate-200/70 rounded-xl overflow-hidden bg-white shadow-sm w-full">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                              <tr className="text-slate-405 font-bold border-b border-slate-100 bg-slate-50/50">
                                <th className="py-2 px-3.5 font-semibold w-[80px]">User</th>
                                <th className="py-2 px-2 font-semibold w-[60px]">PID</th>
                                <th className="py-2 px-2 font-semibold w-[60px]">CPU%</th>
                                <th className="py-2 px-2 font-semibold w-[60px]">MEM%</th>
                                <th className="py-2 pl-2 pr-3.5 font-semibold">COMMAND</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(host.processes ?? [])
                                .filter(p => Number(p.mem || 0) > 0)
                                .sort((a, b) => Number(b.mem || 0) - Number(a.mem || 0))
                                .slice(0, 5)
                                .map((p, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                                    <td className="py-2 px-3.5 text-slate-700 font-semibold">{p.user || 'root'}</td>
                                    <td className="py-2 px-2 text-slate-505 font-mono">{p.pid}</td>
                                    <td className="py-2 px-2 text-slate-650">{p.cpu}%</td>
                                    <td className="py-2 px-2 text-slate-950 font-bold">{p.mem}%</td>
                                    <td className="py-2 pl-2 pr-3.5 text-slate-600 font-mono truncate max-w-[300px]" title={p.cmd || p.process}>
                                      {p.cmd || p.process}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {isVramAlert && (
                    <div className="space-y-4 pl-6 w-full">
                      <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl w-full shadow-inner-sm">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1.5">
                          <span className="text-slate-700 font-bold">GPU VRAM Allocation</span>
                          <span className="font-mono font-bold text-slate-800">{vPct}% ({mb(host.gpu?.mem_used_mb)} / {mb(host.gpu?.mem_total_mb)})</span>
                        </div>
                        <div className="w-full bg-slate-200/70 rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500 bg-rose-500"
                            style={{ width: `${vPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2 w-full">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active GPU Processes</span>
                        <div className="border border-slate-200/70 rounded-xl overflow-hidden bg-white shadow-sm w-full">
                          <table className="w-full text-left text-[11px] border-collapse">
                            <thead>
                              <tr className="text-slate-405 font-bold border-b border-slate-100 bg-slate-50/50">
                                <th className="py-2 px-3.5 font-semibold w-[80px]">User</th>
                                <th className="py-2 px-2 font-semibold w-[60px]">PID</th>
                                <th className="py-2 px-2 font-semibold w-[90px]">GPU VRAM</th>
                                <th className="py-2 pl-2 pr-3.5 font-semibold">COMMAND</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(host.processes ?? [])
                                .filter(p => typeof p.gpu_mem_mb === 'number' && p.gpu_mem_mb > 0)
                                .sort((a, b) => (b.gpu_mem_mb || 0) - (a.gpu_mem_mb || 0))
                                .slice(0, 5)
                                .map((p, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                                    <td className="py-2 px-3.5 text-slate-700 font-semibold">{p.user || 'root'}</td>
                                    <td className="py-2 px-2 text-slate-505 font-mono">{p.pid}</td>
                                    <td className="py-2 px-2 text-slate-950 font-bold font-mono">{mb(p.gpu_mem_mb)}</td>
                                    <td className="py-2 pl-2 pr-3.5 text-slate-600 font-mono truncate max-w-[300px]" title={p.cmd || p.process}>
                                      {p.cmd || p.process}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {isTempAlert && host.gpu && (
                    <div className="space-y-2 pl-6 w-full">
                      <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs shadow-inner-sm w-full">
                        <span className="text-slate-700 font-bold">GPU Temperature</span>
                        <span className="font-mono font-bold text-rose-600">{host.gpu.temp_c}°C</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        The GPU is running extremely hot. Please ensure user training runs are suspended if thermal limits are continuously exceeded.
                      </p>
                    </div>
                  )}

                  {isGpuMetricsAlert && (
                    <div className="pl-6 w-full">
                      <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-650 leading-relaxed shadow-inner-sm w-full">
                        <strong className="text-slate-800">NVIDIA Driver Check:</strong> The NVIDIA driver might have crashed or requires rebuilding. Please log in to the host machine and run <code>nvidia-smi</code> for diagnostics.
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-slate-400 italic text-xs">
            No active warnings on this node.
          </div>
        )}
      </div>
    </div>
  );
}

// 3. Redesigned split-pane workspace for Attention Needed view
export function AttentionNeededWorkspace({ hosts, selectedHost, onSelectHost, pollSeconds = 2 }: {
  hosts: HostStatus[];
  selectedHost: string | null;
  onSelectHost: (name: string) => void;
  pollSeconds?: number;
}) {
  const activeHost = hosts.find(h => h.name === selectedHost) || hosts[0] || null;

  if (hosts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 border border-emerald-100 rounded-2xl bg-white shadow-sm max-w-2xl mx-auto my-8">
        <div className="h-16 w-16 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center text-emerald-500 mb-5 animate-bounce">
          <Check size={32} className="stroke-[3]" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">All Nodes Operational</h3>
        <p className="text-sm text-slate-400 text-center mt-2 max-w-md">
          Great job! There are currently no active warnings, errors, or offline cluster agents reported. All systems are running healthy.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Left Column: Servers List (1/3 width) */}
      <div className="lg:col-span-1 space-y-3">
        <div className="flex justify-between items-center border-b border-slate-200 pb-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
            Attention Needed List
          </h3>
          <span className="text-xs text-slate-405 font-semibold">{hosts.length} items</span>
        </div>
        
        <div className="flex flex-col gap-3 max-h-[75vh] overflow-y-auto pr-1">
          {hosts.map((host) => {
            const active = host.name === selectedHost;
            const isDown = host.state === 'down' || !host.agent_reachable;
            const cPct = cpuPct(host);
            const gPct = host.gpu ? host.gpu.util_gpu : 0;
            const uCount = uniqueUsers(host) || 0;

            return (
              <div
                key={host.name}
                onClick={() => onSelectHost(host.name)}
                className={`rounded-xl border p-4 cursor-pointer shadow-sm flex flex-col justify-between h-[102px] transition-all duration-200 select-none ${
                  active
                    ? 'border-indigo-650 ring-2 ring-indigo-500/20 bg-indigo-50/15 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-350 hover:shadow-md'
                }`}
              >
                {/* Header info */}
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800 text-sm block leading-tight truncate">{host.name}</span>
                    <span className="text-[10px] text-slate-400 font-semibold block mt-0.5 truncate">
                      {host.group} • {host.ip}
                    </span>
                  </div>
                  <span className={`h-2 w-2 rounded-full shrink-0 mt-1 ${
                    host.state === 'idle' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : host.state === 'busy' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]'
                  }`} />
                </div>

                {/* Bottom brief stats */}
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-505 font-mono pt-1.5 border-t border-slate-100 mt-1">
                  {isDown ? (
                    <span className="text-rose-500 font-semibold uppercase tracking-wider truncate">
                      {host.error || 'unreachable'}
                    </span>
                  ) : (
                    <>
                      <span>CPU: <strong className="text-slate-800">{cPct}%</strong></span>
                      <span>GPU: <strong className="text-slate-800">{gPct}%</strong></span>
                      <span>Users: <strong className="text-slate-800">{uCount}</strong></span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Warnings details (2/3 width) */}
      <div className="lg:col-span-2 space-y-4">
        {activeHost ? (
          <HostWarningDetailsView host={activeHost} pollSeconds={pollSeconds} />
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-sm text-slate-400 italic text-sm">
            Select a server from the action list to analyze its warnings.
          </div>
        )}
      </div>
    </div>
  );
}
