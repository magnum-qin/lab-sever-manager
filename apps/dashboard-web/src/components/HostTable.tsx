import { AlertTriangle, HardDrive, MemoryStick, Users, Activity, Server, Layers, Brain, X } from 'lucide-react';
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
};

// 2. Comprehensive Spacious Selected Server Details View
export function HostDetailsView({ host, cpuHistory, gpuHistory, pollSeconds = 2 }: HostDetailsViewProps) {
  const [isOllamaModalOpen, setIsOllamaModalOpen] = useState(false);
  const groups = groupProcesses(host);
  const isDown = host.state === 'down';

  useEffect(() => {
    setIsOllamaModalOpen(false);
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
          {host.state !== 'down' && (
            <button
              onClick={() => setIsOllamaModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-650 bg-indigo-50/40 border border-indigo-100 hover:bg-indigo-100/60 hover:shadow-sm rounded-full px-4 py-1.5 shadow-sm transition-all duration-200 cursor-pointer"
            >
              <Brain size={13} className="text-indigo-500" />
              <span>Manage Ollama</span>
            </button>
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
            ) : null}
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

        {/* Active Warnings Card */}
        <Card className="flex flex-col h-[350px] bg-white border-slate-200">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm mb-3">
            <AlertTriangle size={15} className="text-amber-500" />
            <span>Active Warnings</span>
          </div>
          <div className="space-y-2 overflow-y-auto flex-1 min-h-0 pr-1">
            {(host.alerts ?? []).length ? (
              (host.alerts ?? []).map((alert, i) => (
                <div
                  className={`flex gap-2 rounded-lg border-l-2 p-2.5 text-xs leading-relaxed ${
                    alert.level === 'critical'
                      ? 'border-rose-500 bg-rose-50 text-rose-700'
                      : 'border-amber-500 bg-amber-50 text-amber-700'
                  }`}
                  key={i}
                >
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>{alert.message}</span>
                </div>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic block">No active warnings. All systems normal.</span>
            )}
          </div>
        </Card>
      </div>

      {/* User Processes Card Panels Grid */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
          Active Processes by User
        </h4>
        {groups.length ? (
          <motion.div layout className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {groups.map(({ user, processes, disk, cpu, mem, gpuMem }) => {
                const [containerClass, dotClass] = colorFor(user);
                const totalGpuMem = host.gpus && host.gpus.length > 0 
                  ? host.gpus.reduce((sum, g) => sum + g.mem_total_mb, 0)
                  : (host.gpu ? host.gpu.mem_total_mb : 0);
                const gpuMemPct = totalGpuMem > 0 ? (gpuMem / totalGpuMem) * 100 : 0;
                const getResourceColor = (val: number) => {
                  if (val >= 80) return 'text-rose-500 font-bold';
                  if (val >= 50) return 'text-amber-500 font-bold';
                  return 'text-slate-500';
                };
                
                const isGpuIdle = host.gpus && host.gpus.length > 0 
                  ? host.gpus.every(g => g.util_gpu === 0) 
                  : (host.gpu ? host.gpu.util_gpu === 0 : false);
                
                return (
                  <motion.div
                    key={user}
                    layout
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15, transition: { duration: 0.15 } }}
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    className={`rounded-xl border shadow-sm p-4.5 flex flex-col ${containerClass}`}
                  >
                    {/* User Stats Summary header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                        <span className="font-bold text-slate-800 text-sm">{user}</span>
                        {disk && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-105 border border-slate-200 px-1.5 py-0.5 rounded">
                            {mb(disk.used_mb)} home
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 font-semibold font-mono">
                        {processes.length} procs
                        {" • "}
                        <span className={getResourceColor(cpu)}>CPU {cpu.toFixed(1)}%</span>
                        {" • "}
                        <span className={getResourceColor(mem)}>MEM {mem.toFixed(1)}%</span>
                        {" • "}
                        <span className={getResourceColor(gpuMemPct)}>
                          GPU {gpuMemPct.toFixed(1)}% ({gpuMem ? mb(gpuMem) : '0M'})
                        </span>
                      </span>
                    </div>

                    {/* Processes Subtable */}
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left text-[11px] border-collapse min-w-[420px]">
                        <thead>
                          <tr className="text-slate-400 font-bold border-b border-slate-200/50">
                            <th className="pb-1.5 font-semibold w-[80px]">PID</th>
                            <th className="pb-1.5 font-semibold w-[60px]">CPU</th>
                            <th className="pb-1.5 font-semibold w-[60px]">MEM</th>
                            <th className="pb-1.5 font-semibold w-[90px]">GPU MEM</th>
                            <th className="pb-1.5 font-semibold">COMMAND</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {processes.slice(0, 15).map((process, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="py-1.5 font-mono text-slate-500">{process.pid}</td>
                              <td className="py-1.5 text-slate-700">{process.cpu || '0'}%</td>
                              <td className="py-1.5 text-slate-700">{process.mem || '0'}%</td>
                              <td className="py-1.5 text-slate-700 font-mono">
                                {process.gpu_mem_mb ? (
                                  <div className="flex items-center gap-1">
                                    <span>{mb(process.gpu_mem_mb)}</span>
                                    {isGpuIdle && (
                                      <span
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                                        title="VRAM is occupied while GPU computation is idle (0%)"
                                      >
                                        VRAM Holder
                                      </span>
                                    )}
                                  </div>
                                ) : '-'}
                              </td>
                              <td
                                className="py-1.5 font-mono text-slate-500 truncate max-w-[200px]"
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
                );
              })}
            </AnimatePresence>
          </motion.div>
        ) : (
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
        )}
      </div>

      {/* Ollama Engine Manager Modal Dialog */}
      <AnimatePresence>
        {isOllamaModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
            onClick={() => setIsOllamaModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto relative"
              onClick={(e) => e.stopPropagation()}
            >
              <OllamaManagerCard
                hostName={host.name}
                hostState={host.state}
                onClose={() => setIsOllamaModalOpen(false)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function OllamaManagerCard({ hostName, hostState, onClose }: { hostName: string; hostState: string; onClose?: () => void }) {
  const [running, setRunning] = useState(false);
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStartingOrStopping, setIsStartingOrStopping] = useState(false);
  
  // Pull states
  const [modelTag, setModelTag] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullPercent, setPullPercent] = useState(0);
  const [pullStatus, setPullStatus] = useState<string | null>(null);

  const loadStatus = async () => {
    if (hostState === 'down') {
      setRunning(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ollama/models?host=${hostName}`);
      if (!res.ok) {
        setRunning(false);
        setModels([]);
      } else {
        const data = await res.json();
        setRunning(true);
        setModels(data.models || []);
      }
    } catch (e) {
      setRunning(false);
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [hostName, hostState]);

  const handleControl = async (action: 'start' | 'stop') => {
    setIsStartingOrStopping(true);
    try {
      const res = await fetch(`/api/ollama/control?host=${hostName}&action=${action}`, {
        method: 'POST'
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `${res.status} ${res.statusText}`);
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      await loadStatus();
    } catch (e) {
      alert(`Operation failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      setIsStartingOrStopping(false);
    }
  };

  const handlePull = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelTag.trim()) return;
    setPulling(true);
    setPullPercent(0);
    setPullStatus("Connecting...");
    try {
      const response = await fetch(`/api/ollama/pull?host=${hostName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelTag })
      });
      if (!response.ok) {
        const txt = await response.text();
        throw new Error(txt || "Failed to start pulling");
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            setPullStatus(data.status || "Downloading...");
            if (data.total > 0) {
              setPullPercent(Math.round((data.completed / data.total) * 100));
            }
            if (data.status === "success") {
              setPullStatus("Model installed successfully!");
              setPullPercent(100);
            }
          } catch (e) {
            // ignore partial json
          }
        }
      }
      setModelTag('');
      loadStatus();
    } catch (e) {
      alert(`Pull failed: ${e instanceof Error ? e.message : e}`);
      setPullStatus(null);
    } finally {
      setPulling(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Are you sure you want to delete model ${name}?`)) return;
    try {
      const res = await fetch(`/api/ollama/delete?host=${hostName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `${res.status} ${res.statusText}`);
      }
      loadStatus();
    } catch (e) {
      alert(`Delete failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <Card className="flex flex-col bg-white border-slate-200">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
            OL
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Ollama Engine</h3>
            <p className="text-xs text-slate-400 mt-0.5">Manage LLMs running locally on this host.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {hostState === 'down' ? (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
              Host Down
            </span>
          ) : running ? (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-550 border border-slate-200">
              Stopped
            </span>
          )}

          {hostState !== 'down' && (
            <button
              onClick={() => handleControl(running ? 'stop' : 'start')}
              disabled={isStartingOrStopping || pulling}
              className={`text-xs px-3 py-1.5 rounded-lg border font-bold cursor-pointer transition ${
                running
                  ? 'bg-white border-rose-200 text-rose-600 hover:bg-rose-50'
                  : 'bg-indigo-650 border-indigo-650 text-white hover:bg-indigo-700'
              } disabled:opacity-50`}
            >
              {isStartingOrStopping ? "Wait..." : running ? "Stop Ollama" : "Start Ollama"}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-1.5 rounded-lg transition-colors cursor-pointer"
              title="Close modal"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {running && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-3 border-t border-slate-100">
          <div className="lg:col-span-2 flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Installed Models ({models.length})</span>
            <div className="flex-1 overflow-y-auto max-h-[200px] pr-3 space-y-1 divide-y divide-slate-100 min-h-[120px]">
              {models.length > 0 ? (
                models.map((m: any, idx: number) => {
                  const sizeGB = (m.size / 1024 / 1024 / 1024).toFixed(2);
                  return (
                    <div key={idx} className="flex justify-between items-center py-2 text-xs font-mono">
                      <div className="min-w-0 flex-1 pr-3">
                        <span className="text-slate-800 font-bold truncate block">{m.name}</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5 font-sans">Family: {m.details?.family || 'unknown'} • Size: {sizeGB} GB</span>
                      </div>
                      <button
                        onClick={() => handleDelete(m.name)}
                        className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-300 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer shrink-0 font-sans"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })
              ) : (
                <span className="text-xs text-slate-400 italic block py-2">No models installed. Use the form to pull models.</span>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 border-t lg:border-t-0 lg:border-l lg:border-slate-100 pt-4 lg:pt-0 lg:pl-4 flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Download LLM Model</span>
            <form onSubmit={handlePull} className="space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="e.g. qwen2.5:7b or llama3"
                  value={modelTag}
                  onChange={(e) => setModelTag(e.target.value)}
                  disabled={pulling}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                
                {pulling && pullStatus && (
                  <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg space-y-1">
                    <div className="flex justify-between text-[9px] font-bold font-mono text-slate-500">
                      <span className="truncate pr-1">{pullStatus}</span>
                      <span>{pullPercent}%</span>
                    </div>
                    {pullPercent > 0 && (
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-650 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, pullPercent)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={pulling || !modelTag.trim()}
                className="w-full py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition disabled:opacity-50 cursor-pointer mt-3"
              >
                {pulling ? "Pulling..." : "Pull Model"}
              </button>
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
