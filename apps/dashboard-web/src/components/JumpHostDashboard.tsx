import React, { useEffect, useState } from 'react';
import { Card, ProgressMetric } from './Primitives';
import { 
  Laptop, Cpu, HardDrive, Clock, RefreshCw, Activity, Terminal, 
  Globe, Folder, Gamepad2, MessageSquare, Code, Database, BarChart3, Settings,
  Plus, Trash2, Edit, X, Power
} from 'lucide-react';

interface WinDiskInfo {
  DeviceID: string;
  Size: number;
  FreeSpace: number;
}

interface WinProcessInfo {
  Id: number;
  ProcessName: string;
  CPU: number | null;
  WorkingSet64: number;
}

interface JumpHostStatus {
  cpu_util_pct: number;
  mem_total_kb: number;
  mem_free_kb: number;
  os_name: string;
  last_boot_time: string;
  disks: WinDiskInfo[];
  processes: WinProcessInfo[];
  users: string;
}

interface JumpHostDashboardProps {
  clusterHosts: { name: string; ip: string }[];
}

interface PortProxyMapping {
  listen_address: string;
  listen_port: number;
  connect_address: string;
  connect_port: number;
}

const formatGB = (bytes: number) => {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1000) {
    return (gb / 1024).toFixed(1) + ' TB';
  }
  return gb.toFixed(1) + ' GB';
};

const formatKBtoGB = (kb: number) => {
  return (kb / (1024 * 1024)).toFixed(1) + ' GB';
};

const formatUptime = (lastBootTime: string) => {
  if (!lastBootTime) return 'Unknown';
  const bootDate = new Date(lastBootTime.replace(' ', 'T'));
  if (isNaN(bootDate.getTime())) return 'Unknown';

  const diffMs = Date.now() - bootDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 0) return 'Just Booted';

  const days = Math.floor(diffSecs / 86400);
  const hours = Math.floor((diffSecs % 86400) / 3600);
  const mins = Math.floor((diffSecs % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  
  return parts.join(' ');
};

const getProcessIcon = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.includes('msedge') || lower.includes('chrome') || lower.includes('firefox') || lower.includes('safari') || lower.includes('browser')) {
    return <Globe className="text-sky-500 shrink-0" size={14} />;
  }
  if (lower.includes('python')) {
    return <Terminal className="text-emerald-500 shrink-0" size={14} />;
  }
  if (lower.includes('tailscale')) {
    return <Settings className="text-indigo-500 shrink-0" size={14} />;
  }
  if (lower.includes('explorer')) {
    return <Folder className="text-amber-500 shrink-0" size={14} />;
  }
  if (lower.includes('steam')) {
    return <Gamepad2 className="text-slate-500 shrink-0" size={14} />;
  }
  if (lower.includes('qq') || lower.includes('wechat') || lower.includes('chat') || lower.includes('slack') || lower.includes('discord') || lower.includes('pal')) {
    if (lower.includes('pal')) {
      return <Gamepad2 className="text-indigo-550 shrink-0" size={14} />;
    }
    return <MessageSquare className="text-emerald-600 shrink-0" size={14} />;
  }
  if (lower.includes('code') || lower.includes('language_server') || lower.includes('node') || lower.includes('git')) {
    return <Code className="text-blue-500 shrink-0" size={14} />;
  }
  if (lower.includes('sql') || lower.includes('redis') || lower.includes('mongo') || lower.includes('db')) {
    return <Database className="text-indigo-400 shrink-0" size={14} />;
  }
  if (lower.includes('svchost') || lower.includes('system') || lower.includes('wininit') || lower.includes('services') || lower.includes('lsass') || lower.includes('csrss') || lower.includes('smss') || lower.includes('registry')) {
    return <Settings className="text-slate-400 shrink-0" size={14} />;
  }
  if (lower.includes('taskmgr') || lower.includes('perfmon')) {
    return <BarChart3 className="text-rose-500 shrink-0" size={14} />;
  }
  if (lower.includes('dashboard') || lower.includes('manager')) {
    return <Activity className="text-indigo-600 shrink-0" size={14} />;
  }
  return <Cpu className="text-slate-400 shrink-0" size={14} />;
};

export default function JumpHostDashboard({ clusterHosts }: JumpHostDashboardProps) {
  const [status, setStatus] = useState<JumpHostStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [isPalModalOpen, setIsPalModalOpen] = useState(false);

  // Port Proxy states
  const [mappings, setMappings] = useState<PortProxyMapping[]>([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [mappingsError, setMappingsError] = useState<string | null>(null);
  const [isAddMappingOpen, setIsAddMappingOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<PortProxyMapping | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/jump-host/status');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      const data: JumpHostStatus = await res.json();
      setStatus(data);
      setError(null);
      
      setCpuHistory(prev => {
        const next = [...prev, data.cpu_util_pct];
        if (next.length > 30) {
          return next.slice(next.length - 30);
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadMappings = async () => {
    setMappingsLoading(true);
    setMappingsError(null);
    try {
      const res = await fetch('/api/portproxy');
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json() as PortProxyMapping[];
      setMappings(data || []);
    } catch (e) {
      setMappingsError(e instanceof Error ? e.message : String(e));
    } finally {
      setMappingsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    loadMappings();
    const timer = setInterval(fetchStatus, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleDeleteMapping = async (listenAddress: string, listenPort: number) => {
    if (!window.confirm(`Are you sure you want to delete mapping on port ${listenPort}?`)) return;
    try {
      const res = await fetch('/api/portproxy/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listen_address: listenAddress, listen_port: listenPort })
      });
      if (!res.ok) {
        throw new Error(await res.text() || `${res.status} ${res.statusText}`);
      }
      loadMappings();
    } catch (e) {
      alert(`Delete failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  if (loading && !status) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20">
        <RefreshCw className="animate-spin text-indigo-650 mb-4" size={32} />
        <span className="text-sm font-semibold text-slate-455">Connecting to Jump Host...</span>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className="p-6">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800 flex flex-col gap-3">
          <h3 className="font-bold text-sm">Failed to connect to Jump Host</h3>
          <p className="text-xs text-rose-600 font-mono">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchStatus(); }}
            className="self-start px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors mt-2"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const usedMemKb = status.mem_total_kb - status.mem_free_kb;
  const memPercent = status.mem_total_kb > 0 ? (usedMemKb * 100) / status.mem_total_kb : 0;

  // Detect Palworld Server Process
  const palServerProc = status.processes?.find(p => p.ProcessName.toLowerCase().includes('palserver'));
  const isPalOnline = !!palServerProc;
  const palMemBytes = palServerProc ? palServerProc.WorkingSet64 : 0;

  // Get Top 10 memory processes
  const topProcesses = status.processes ? status.processes.slice(0, 10) : [];

  return (
    <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Title Header Card */}
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
            <Laptop size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-slate-800 text-lg leading-tight">Jump Host Status</h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">Tailscale IP: 100.64.0.1</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
          <div className="flex items-center gap-2 text-xs">
            <Terminal size={14} className="text-slate-400" />
            <span className="text-slate-400">OS:</span>
            <span className="font-semibold text-slate-700">{status.os_name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Clock size={14} className="text-slate-400" />
            <span className="text-slate-400">Uptime:</span>
            <span className="font-semibold text-slate-700 font-mono">{formatUptime(status.last_boot_time)}</span>
          </div>
        </div>
      </Card>

      {/* Hardware Performance Row (CPU, Memory, Storage) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* CPU Util Card */}
        <Card className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">CPU Utilization</span>
            <Cpu size={16} className="text-slate-400" />
          </div>
          <div className="pt-2">
            <ProgressMetric
              label="Processor Load"
              value={`${status.cpu_util_pct}%`}
              percent={status.cpu_util_pct}
            />
          </div>
          <div className="text-[10px] text-slate-450 leading-tight">
            Overall logical core average workload.
          </div>
        </Card>

        {/* Memory Usage Card */}
        <Card className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">System Memory</span>
            <Activity size={16} className="text-slate-400" />
          </div>
          <div className="pt-2">
            <ProgressMetric
              label="RAM Allocated"
              value={`${formatKBtoGB(usedMemKb)} / ${formatKBtoGB(status.mem_total_kb)}`}
              percent={memPercent}
            />
          </div>
          <div className="text-[10px] text-slate-455 leading-tight flex justify-between">
            <span>Free: {formatKBtoGB(status.mem_free_kb)}</span>
            <span>Allocated: {memPercent.toFixed(1)}%</span>
          </div>
        </Card>

        {/* Storage Drives (inside same row) */}
        {status.disks && status.disks.map(disk => {
          const usedSize = disk.Size - disk.FreeSpace;
          const usePct = disk.Size > 0 ? Math.round((usedSize * 100) / disk.Size) : 0;
          return (
            <Card key={disk.DeviceID} className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <HardDrive size={16} className="text-indigo-500" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Drive {disk.DeviceID}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{usePct}% Used</span>
              </div>
              <div className="pt-2">
                <ProgressMetric
                  label="Used Capacity"
                  value={`${formatGB(usedSize)} / ${formatGB(disk.Size)}`}
                  percent={usePct}
                />
              </div>
              <div className="text-[10px] text-slate-450 leading-tight text-right">
                Free Space: {formatGB(disk.FreeSpace)}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Services & Network Mappings Cards Row (Palworld, Processes, Port Mappings) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Palworld Server Card (col-span-3) */}
        <Card className="lg:col-span-3 flex flex-col justify-between p-5 min-h-[350px]">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Palworld Server</span>
              <Gamepad2 size={18} className="text-indigo-500" />
            </div>
            
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3.5 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs">Status:</span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isPalOnline 
                    ? 'bg-emerald-50 border border-emerald-250 text-emerald-700' 
                    : 'bg-slate-100 border border-slate-200 text-slate-500'
                }`}>
                  <span className={`h-1 w-1 rounded-full ${isPalOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {isPalOnline ? 'Online' : 'Offline'}
                </span>
              </div>
              {isPalOnline && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs">PID:</span>
                    <span className="font-bold text-slate-800 text-xs font-mono">{palServerProc.Id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 text-xs">Memory:</span>
                    <span className="font-bold text-slate-800 text-xs font-mono">{formatGB(palMemBytes)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            onClick={() => setIsPalModalOpen(true)}
            className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/50 rounded-lg text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer mt-4"
          >
            <Settings size={13} />
            Manage Settings
          </button>
        </Card>

        {/* 2. Top Processes by Memory (col-span-5) */}
        <Card className="lg:col-span-5 flex flex-col p-5 min-h-[350px] overflow-hidden">
          <div className="mb-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Top Processes</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Top 10 resource-heavy active processes.</p>
          </div>

          <div className="overflow-y-auto flex-1 -mx-5 -mb-5 pr-1.5 scrollbar-thin">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-y border-slate-100 font-bold text-slate-400">
                  <th className="py-2 px-5 w-16">PID</th>
                  <th className="py-2 px-3">Process Name</th>
                  <th className="py-2 px-5 text-right w-24">Memory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {topProcesses.map((proc, idx) => (
                  <tr key={`${proc.Id}-${idx}`} className="hover:bg-slate-50/30 transition-colors">
                    <td className="py-2 px-5 font-mono text-slate-400">{proc.Id}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800 truncate max-w-[120px]">
                      <div className="flex items-center gap-1.5">
                        {getProcessIcon(proc.ProcessName)}
                        <span>{proc.ProcessName}</span>
                      </div>
                    </td>
                    <td className="py-2 px-5 text-right font-mono text-slate-650">
                      {formatGB(proc.WorkingSet64)}
                    </td>
                  </tr>
                ))}
                {topProcesses.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-10 text-center text-slate-400 italic">
                      No active processes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 3. Active Port Mappings (col-span-4) */}
        <Card className="lg:col-span-4 flex flex-col p-5 min-h-[350px] overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Port Mappings</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Windows netsh proxy rules.</p>
            </div>
            <button
              onClick={() => setIsAddMappingOpen(true)}
              className="p-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded border border-indigo-200/50 cursor-pointer transition"
              title="Add Port Mapping"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 -mx-5 -mb-5 pr-1.5 scrollbar-thin">
            {mappingsLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="animate-spin text-slate-400" size={16} />
              </div>
            ) : mappingsError ? (
              <div className="text-rose-500 p-4 text-center text-[10px] font-semibold">
                Error: {mappingsError}
              </div>
            ) : mappings.length === 0 ? (
              <div className="text-slate-400 text-center py-20 italic">
                No active mappings.
              </div>
            ) : (
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-y border-slate-100 font-bold text-slate-400">
                    <th className="py-2 px-5">Port</th>
                    <th className="py-2 px-3">Target Node (IP)</th>
                    <th className="py-2 px-5 text-right w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                  {mappings.map((m, idx) => {
                    const hostObj = clusterHosts.find(h => h.ip === m.connect_address);
                    const label = hostObj ? hostObj.name : m.connect_address;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                        <td className="py-2 px-5 font-bold text-slate-800">{m.listen_port}</td>
                        <td className="py-2 px-3 text-slate-600 truncate max-w-[110px]" title={`${label}:${m.connect_port}`}>
                          {label} <span className="text-[9px] text-slate-400">({m.connect_port})</span>
                        </td>
                        <td className="py-2 px-5 text-right font-sans">
                          <div className="flex items-center justify-end gap-2.5">
                            <button
                              onClick={() => setEditingMapping(m)}
                              className="text-slate-400 hover:text-indigo-600 cursor-pointer border-0 bg-transparent p-0 flex items-center"
                              title="Edit Mapping"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteMapping(m.listen_address, m.listen_port)}
                              className="text-rose-650 hover:text-rose-800 cursor-pointer border-0 bg-transparent p-0 flex items-center"
                              title="Delete Mapping"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* Palworld Settings Modal */}
      {isPalModalOpen && (
        <PalworldSettingsModal onClose={() => setIsPalModalOpen(false)} onRestartComplete={fetchStatus} />
      )}

      {/* Add Port Mapping Modal */}
      {isAddMappingOpen && (
        <AddPortMappingModal 
          clusterHosts={clusterHosts} 
          onClose={() => setIsAddMappingOpen(false)} 
          onAddComplete={() => { loadMappings(); setIsAddMappingOpen(false); }} 
        />
      )}

      {/* Edit Port Mapping Modal */}
      {editingMapping && (
        <EditPortMappingModal
          clusterHosts={clusterHosts}
          mapping={editingMapping}
          onClose={() => setEditingMapping(null)}
          onEditComplete={() => { loadMappings(); setEditingMapping(null); }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Helper Component: Add Port Mapping Modal
// -------------------------------------------------------------
interface AddPortMappingModalProps {
  clusterHosts: { name: string; ip: string }[];
  onClose: () => void;
  onAddComplete: () => void;
}

function AddPortMappingModal({ clusterHosts, onClose, onAddComplete }: AddPortMappingModalProps) {
  const [listenAddress, setListenAddress] = useState('100.64.0.1');
  const [listenPort, setListenPort] = useState('');
  const [connectAddress, setConnectAddress] = useState('');
  const [connectPort, setConnectPort] = useState('11433');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (clusterHosts.length > 0 && !connectAddress) {
      setConnectAddress(clusterHosts[0].ip);
    }
  }, [clusterHosts, connectAddress]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listenPort || !connectAddress || !connectPort) {
      setError("Please fill in all fields.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/portproxy/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listen_address: listenAddress,
          listen_port: Number(listenPort),
          connect_address: connectAddress,
          connect_port: Number(connectPort)
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `${res.status} ${res.statusText}`);
      }
      onAddComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-5 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Plus className="text-indigo-650" size={18} />
            <h3 className="font-bold text-slate-800 text-sm">Add Port Mapping</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-650 rounded-lg hover:bg-slate-200/50 transition cursor-pointer border-0 bg-transparent">
            <X size={18} />
          </button>
        </div>

        {/* Body content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Listen IP</label>
            <input
              type="text"
              value={listenAddress}
              onChange={(e) => setListenAddress(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-700"
              placeholder="e.g. 100.64.0.1"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Listen Port</label>
            <input
              type="number"
              value={listenPort}
              onChange={(e) => setListenPort(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-800"
              placeholder="e.g. 11449"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Node</label>
            <select
              value={connectAddress}
              onChange={(e) => setConnectAddress(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-semibold text-slate-700 bg-slate-50 cursor-pointer"
            >
              {clusterHosts.map((h) => (
                <option key={h.ip} value={h.ip}>
                  {h.name} ({h.ip})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Port</label>
            <input
              type="number"
              value={connectPort}
              onChange={(e) => setConnectPort(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-750"
              placeholder="11433"
              required
            />
          </div>

          {error && (
            <div className="text-rose-500 text-[10px] font-semibold bg-rose-50 border border-rose-100 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2 border border-slate-200 text-slate-650 hover:bg-slate-100 rounded-lg font-bold transition disabled:opacity-50 cursor-pointer bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1 border-0"
            >
              {submitting ? "Adding..." : "Add Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Helper Component: Edit Port Mapping Modal
// -------------------------------------------------------------
interface EditPortMappingModalProps {
  clusterHosts: { name: string; ip: string }[];
  mapping: PortProxyMapping;
  onClose: () => void;
  onEditComplete: () => void;
}

function EditPortMappingModal({ clusterHosts, mapping, onClose, onEditComplete }: EditPortMappingModalProps) {
  const [listenAddress, setListenAddress] = useState(mapping.listen_address);
  const [listenPort, setListenPort] = useState(mapping.listen_port.toString());
  const [connectAddress, setConnectAddress] = useState(mapping.connect_address);
  const [connectPort, setConnectPort] = useState(mapping.connect_port.toString());
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listenPort || !connectAddress || !connectPort) {
      setError("Please fill in all fields.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // 1. Delete old mapping rule first
      const delRes = await fetch('/api/portproxy/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listen_address: mapping.listen_address,
          listen_port: mapping.listen_port
        })
      });
      if (!delRes.ok) {
        throw new Error(`Failed to remove old rule: ${await delRes.text()}`);
      }

      // 2. Add new mapping rule
      const addRes = await fetch('/api/portproxy/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listen_address: listenAddress,
          listen_port: Number(listenPort),
          connect_address: connectAddress,
          connect_port: Number(connectPort)
        })
      });
      if (!addRes.ok) {
        // If adding new rule fails, try to restore the old one
        await fetch('/api/portproxy/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            listen_address: mapping.listen_address,
            listen_port: mapping.listen_port,
            connect_address: mapping.connect_address,
            connect_port: mapping.connect_port
          })
        });
        throw new Error(`Failed to create new rule: ${await addRes.text()}`);
      }

      onEditComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-5 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Edit className="text-indigo-650" size={18} />
            <h3 className="font-bold text-slate-800 text-sm">Edit Port Mapping</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-650 rounded-lg hover:bg-slate-200/50 transition cursor-pointer border-0 bg-transparent">
            <X size={18} />
          </button>
        </div>

        {/* Body content */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Listen IP</label>
            <input
              type="text"
              value={listenAddress}
              onChange={(e) => setListenAddress(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-700"
              placeholder="e.g. 100.64.0.1"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Listen Port</label>
            <input
              type="number"
              value={listenPort}
              onChange={(e) => setListenPort(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-800"
              placeholder="e.g. 11449"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Node</label>
            <select
              value={connectAddress}
              onChange={(e) => setConnectAddress(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-semibold text-slate-700 bg-slate-50 cursor-pointer"
            >
              {clusterHosts.map((h) => (
                <option key={h.ip} value={h.ip}>
                  {h.name} ({h.ip})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Port</label>
            <input
              type="number"
              value={connectPort}
              onChange={(e) => setConnectPort(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-750"
              placeholder="11433"
              required
            />
          </div>

          {error && (
            <div className="text-rose-500 text-[10px] font-semibold bg-rose-50 border border-rose-100 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2 border border-slate-200 text-slate-650 hover:bg-slate-100 rounded-lg font-bold transition disabled:opacity-50 cursor-pointer bg-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1 border-0"
            >
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Helper Component: Palworld Settings Modal
// -------------------------------------------------------------
interface PalworldSettingsModalProps {
  onClose: () => void;
  onRestartComplete: () => void;
}

function PalworldSettingsModal({ onClose, onRestartComplete }: PalworldSettingsModalProps) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/palworld/settings');
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key: string, val: string) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  const handleSaveAndRestart = async () => {
    if (!window.confirm("Are you sure you want to save these settings and restart the Palworld Server? Users will be disconnected briefly.")) return;
    setSaving(true);
    setError(null);
    try {
      const saveRes = await fetch('/api/palworld/settings/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!saveRes.ok) throw new Error(`Save failed: ${await saveRes.text()}`);

      const restartRes = await fetch('/api/palworld/control?action=restart', {
        method: 'POST'
      });
      if (!restartRes.ok) throw new Error(`Restart failed: ${await restartRes.text()}`);

      alert("Settings saved and Palworld Server restarted successfully!");
      onRestartComplete();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const getVal = (key: string, def = '') => {
    return settings[key] !== undefined ? settings[key].replace(/^"|"$/g, '') : def;
  };

  const setVal = (key: string, val: string, isString = false) => {
    const formatted = isString ? `"${val}"` : val;
    handleChange(key, formatted);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-5 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Gamepad2 className="text-indigo-650" size={20} />
            <h3 className="font-bold text-slate-800 text-sm">Palworld Game Server Settings</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-650 rounded-lg hover:bg-slate-200/50 transition cursor-pointer border-0 bg-transparent">
            <X size={18} />
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 flex-1 overflow-y-auto min-h-0 text-xs">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <RefreshCw className="animate-spin text-indigo-650 mb-3" size={24} />
              <span className="text-slate-455 font-medium">Fetching server settings...</span>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl font-medium">
              Error: {error}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Settings Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                {/* Server info group */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider border-b border-slate-100 pb-1.5">Server Profile / 服务器档案</h4>
                  
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider">Server Name (服务器名称)</label>
                    <input
                      type="text"
                      value={getVal('ServerName')}
                      onChange={e => setVal('ServerName', e.target.value, true)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-semibold text-slate-700"
                    />
                    <span className="block text-[9px] text-slate-400 leading-normal">游戏大厅联机列表中所显示的服务器名称标题。</span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider">Server Password (服务器密码)</label>
                    <input
                      type="text"
                      value={getVal('ServerPassword')}
                      onChange={e => setVal('ServerPassword', e.target.value, true)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      placeholder="No password"
                    />
                    <span className="block text-[9px] text-slate-400 leading-normal">进入服务器时需要输入的安全进入密码，为空则任何人可连。</span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider">Admin Password (管理员密码)</label>
                    <input
                      type="text"
                      value={getVal('AdminPassword')}
                      onChange={e => setVal('AdminPassword', e.target.value, true)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <span className="block text-[9px] text-slate-400 leading-normal">获取游戏内管理员身份（/AdminPassword &lt;密码&gt;）的超级管理密码。</span>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider">Server Description (服务器描述)</label>
                    <textarea
                      value={getVal('ServerDescription')}
                      onChange={e => setVal('ServerDescription', e.target.value, true)}
                      rows={2}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-medium text-slate-700"
                    />
                    <span className="block text-[9px] text-slate-400 leading-normal">展示在服务器列表详情面板中的背景描述文字。</span>
                  </div>
                </div>

                {/* Game rule group */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider border-b border-slate-100 pb-1.5">Game Rules / 游戏规则</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider">Difficulty (难度)</label>
                      <select
                        value={getVal('Difficulty', 'None')}
                        onChange={e => setVal('Difficulty', e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-semibold text-slate-700 bg-slate-50 cursor-pointer"
                      >
                        <option value="None">None (无)</option>
                        <option value="Normal">Normal (普通)</option>
                        <option value="Hard">Hard (困难)</option>
                      </select>
                      <span className="block text-[9px] text-slate-400 leading-normal">服务器环境整体难度。</span>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider">Max Players (最大玩家)</label>
                      <input
                        type="number"
                        value={getVal('ServerPlayerMaxNum', '32')}
                        onChange={e => setVal('ServerPlayerMaxNum', e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-slate-700"
                      />
                      <span className="block text-[9px] text-slate-400 leading-normal">最高在线玩家数限制。</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider">EXP Rate (经验值倍率)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={getVal('ExpRate', '1.0')}
                        onChange={e => setVal('ExpRate', e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-semibold"
                      />
                      <span className="block text-[9px] text-slate-400 leading-normal">获取经验的结算增幅倍数。</span>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider">Pal Egg Hatch (孵蛋时间)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={getVal('PalEggDefaultHatchingTime', '0.0')}
                        onChange={e => setVal('PalEggDefaultHatchingTime', e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-semibold"
                      />
                      <span className="block text-[9px] text-slate-400 leading-normal">巨蛋孵化所需的物理小时。</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider">Workers/Base (工作数)</label>
                      <input
                        type="number"
                        value={getVal('BaseCampWorkerMaxNum', '15')}
                        onChange={e => setVal('BaseCampWorkerMaxNum', e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-semibold"
                      />
                      <span className="block text-[9px] text-slate-400 leading-normal">据点终端工作的帕鲁最大数。</span>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider">Pal Spawn Rate (生成倍率)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={getVal('PalSpawnNumRate', '1.0')}
                        onChange={e => setVal('PalSpawnNumRate', e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-semibold"
                      />
                      <span className="block text-[9px] text-slate-400 leading-normal">野生帕鲁刷怪倍率与密度。</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider">Death Penalty (死亡惩罚)</label>
                    <select
                      value={getVal('DeathPenalty', 'Item')}
                      onChange={e => setVal('DeathPenalty', e.target.value)}
                      className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans font-semibold text-slate-700 bg-slate-50 cursor-pointer"
                    >
                      <option value="None">None (不掉落任何物品)</option>
                      <option value="Item">Item (仅掉落背包道具，保留装备与帕鲁)</option>
                      <option value="ItemAndEquipment">ItemAndEquipment (掉落道具与装备，保留帕鲁)</option>
                      <option value="All">All (全部掉落：道具、装备以及身上帕鲁全部留地)</option>
                    </select>
                    <span className="block text-[9px] text-slate-400 leading-normal">玩家角色意外死亡时的掉落惩罚规则。</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-5 shrink-0 bg-slate-50 flex items-center justify-between">
          <div className="text-[10px] text-slate-400 font-medium max-w-[50%] leading-normal">
            * 提示：保存设置将自动重启帕鲁服务器进程，这会导致在线玩家短暂断线。
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-slate-200 text-slate-650 hover:bg-slate-100 rounded-lg font-bold transition disabled:opacity-50 cursor-pointer bg-white"
            >
              取消
            </button>
            <button
              onClick={handleSaveAndRestart}
              disabled={saving || loading || error !== null}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5 border-0"
            >
              {saving ? (
                <>
                  <RefreshCw className="animate-spin" size={14} />
                  保存并重启中...
                </>
              ) : (
                <>
                  <Power size={14} />
                  保存并重启服务器
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
