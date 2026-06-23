import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Gauge, RefreshCw, Server, Search, Play, Pause, Network } from 'lucide-react';
import { HostCardsGrid, HostDetailsView, HostWarningDetailsView } from './components/HostTable';
import { Card } from './components/Primitives';
import { cpuPct, rowSignature } from './metrics';
import type { StatusResponse } from './types';
import './styles.css';

function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signatures, setSignatures] = useState<Map<string, string>>(new Map());
  const signatureRef = useRef<Map<string, string>>(new Map());

  // Selected server state
  const [selectedHost, setSelectedHost] = useState<string>('');
  
  // Advanced controls state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'idle' | 'busy' | 'down'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'cpu' | 'gpu' | 'vram'>('name');
  const [isPaused, setIsPaused] = useState(false);
  const [pollInterval, setPollInterval] = useState(2);
  const [activeTab, setActiveTab] = useState<'all' | 'a6000' | 'rtx4090' | 'attention' | 'port-mappings'>('all');

  useEffect(() => {
    if (isPaused) return;

    let stopped = false;
    async function refresh() {
      try {
        const response = await fetch('/api/status', { cache: 'no-store' });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const next = await response.json() as StatusResponse;
        if (stopped) return;
        setError(null);
        setSignatures(new Map(signatureRef.current));
        signatureRef.current = new Map(next.hosts.map((host) => [host.name, rowSignature(host)]));
        setStatus(next);
      } catch (err) {
        if (!stopped) setError(err instanceof Error ? err.message : String(err));
      }
    }
    refresh();
    const id = window.setInterval(refresh, pollInterval * 1000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [isPaused, pollInterval]);

  const alerts = useMemo(() => status?.hosts.flatMap((host) => (host.alerts ?? []).map((alert) => ({ host: host.name, ...alert }))) ?? [], [status]);

  // Tab count calculations
  const hostsCounts = useMemo(() => {
    if (!status) return { all: 0, a6000: 0, rtx4090: 0, attention: 0 };
    const all = status.hosts.length;
    const a6000 = status.hosts.filter(h => h.group.toUpperCase() === 'A6000').length;
    const rtx4090 = status.hosts.filter(h => h.group.toUpperCase().includes('4090') || h.group.toUpperCase().includes('RTX')).length;
    const attention = status.hosts.filter(h => h.state === 'down' || (h.alerts && h.alerts.length > 0)).length;
    return { all, a6000, rtx4090, attention };
  }, [status]);

  // Filter & Sort hosts
  const filteredHosts = useMemo(() => {
    if (!status) return [];
    let list = status.hosts;

    // 1. Tab filter
    switch (activeTab) {
      case 'a6000':
        list = status.hosts.filter(h => h.group.toUpperCase() === 'A6000');
        break;
      case 'rtx4090':
        list = status.hosts.filter(h => h.group.toUpperCase().includes('4090') || h.group.toUpperCase().includes('RTX'));
        break;
      case 'attention':
        list = status.hosts.filter(h => h.state === 'down' || (h.alerts && h.alerts.length > 0));
        break;
      case 'all':
      default:
        break;
    }

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        h => h.name.toLowerCase().includes(q) ||
             h.ip.includes(q) ||
             h.group.toLowerCase().includes(q)
      );
    }

    // 3. Status filter
    if (statusFilter !== 'all') {
      list = list.filter(h => h.state === statusFilter);
    }

    // 4. Sort
    const sorted = [...list];
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'cpu') {
      sorted.sort((a, b) => cpuPct(b) - cpuPct(a));
    } else if (sortBy === 'gpu') {
      sorted.sort((a, b) => {
        const ga = a.gpu ? a.gpu.util_gpu : 0;
        const gb = b.gpu ? b.gpu.util_gpu : 0;
        return gb - ga;
      });
    } else if (sortBy === 'vram') {
      sorted.sort((a, b) => {
        const va = a.gpu && a.gpu.mem_total_mb > 0 ? (a.gpu.mem_used_mb / a.gpu.mem_total_mb) : 0;
        const vb = b.gpu && b.gpu.mem_total_mb > 0 ? (b.gpu.mem_used_mb / b.gpu.mem_total_mb) : 0;
        return vb - va;
      });
    }
    return sorted;
  }, [status, activeTab, searchQuery, statusFilter, sortBy]);

  // Set default selected host when status is loaded
  useEffect(() => {
    if (status && status.hosts.length > 0 && !selectedHost) {
      setSelectedHost(status.hosts[0].name);
    }
  }, [status, selectedHost]);

  // Sync selected host when filter tabs are toggled
  useEffect(() => {
    if (filteredHosts.length > 0) {
      const exists = filteredHosts.some(h => h.name === selectedHost);
      if (!exists) {
        setSelectedHost(filteredHosts[0].name);
      }
    }
  }, [activeTab, filteredHosts, selectedHost]);

  // Get active host properties
  const activeHostData = useMemo(() => {
    if (!status) return null;
    return status.hosts.find(h => h.name === selectedHost) || null;
  }, [status, selectedHost]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row antialiased">
      {/* Desktop Left Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 shrink-0 hidden md:flex flex-col sticky top-0 h-screen py-6 px-4 justify-between z-10">
        <div className="space-y-6">
          {/* Brand/Workspace Selector card */}
          <div className="flex items-center gap-3 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="h-9 w-9 flex items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-sm shadow-[0_2px_8px_rgba(79,70,229,0.25)] shrink-0">
              GP
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-800 text-sm block leading-tight truncate">GPU Lab Ops</span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Administrator</span>
            </div>
          </div>

          {/* Navigation Items */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-2 block mb-2">
              Navigation
            </span>
            <SidebarItem
              icon={<Gauge size={16} />}
              label="Overview"
              active={activeTab === 'all'}
              count={hostsCounts.all}
              onClick={() => setActiveTab('all')}
            />
            <SidebarItem
              icon={<Server size={16} />}
              label="A6000 Cluster"
              active={activeTab === 'a6000'}
              count={hostsCounts.a6000}
              onClick={() => setActiveTab('a6000')}
            />
            <SidebarItem
              icon={<Server size={16} />}
              label="RTX 4090 Cluster"
              active={activeTab === 'rtx4090'}
              count={hostsCounts.rtx4090}
              onClick={() => setActiveTab('rtx4090')}
            />
            <SidebarItem
              icon={<Network size={16} />}
              label="Port Mappings"
              active={activeTab === 'port-mappings'}
              onClick={() => setActiveTab('port-mappings')}
              hideCount={true}
            />
            <SidebarItem
              icon={<AlertTriangle size={16} />}
              label="Attention Needed"
              active={activeTab === 'attention'}
              count={hostsCounts.attention}
              onClick={() => setActiveTab('attention')}
              isWarning={hostsCounts.attention > 0}
            />
          </div>
        </div>

        {/* Profile Card at Bottom */}
        <div className="flex items-center gap-3 border-t border-slate-100 pt-4 px-2">
          <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
            JA
          </div>
          <div className="min-w-0">
            <span className="font-bold text-slate-800 text-xs block leading-tight truncate">James Admin</span>
            <span className="text-[9px] text-slate-400 font-medium block mt-0.5">ts-win-jump</span>
          </div>
        </div>
      </aside>

      {/* Mobile Top Navbar */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-slate-200 w-full h-16 px-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs">
            GP
          </div>
          <span className="font-bold text-slate-800 text-sm">GPU Lab Ops</span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveTab('all')}
            className={`p-2 rounded-lg border text-xs font-semibold ${
              activeTab === 'all' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            All ({hostsCounts.all})
          </button>
          <button
            onClick={() => setActiveTab('attention')}
            className={`relative p-2 rounded-lg border text-xs font-semibold ${
              activeTab === 'attention' ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-slate-200 text-slate-500'
            }`}
          >
            Alerts ({hostsCounts.attention})
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 min-w-0 p-6 md:p-8 max-w-7xl mx-auto w-full flex flex-col gap-6">
        {/* Toolbar: Search, Filter, Sort, Refresh Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          {/* Left: Search & Filter & Sort */}
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative max-w-xs w-full">
              <input
                type="text"
                placeholder="Search hosts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-205 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-medium text-slate-400">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-650"
              >
                <option value="all">All Statuses</option>
                <option value="idle">Idle</option>
                <option value="busy">Busy</option>
                <option value="down">Down</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-medium text-slate-400">Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-semibold text-slate-650"
              >
                <option value="name">Name (A-Z)</option>
                <option value="cpu">CPU Load (High-Low)</option>
                <option value="gpu">GPU Load (High-Low)</option>
                <option value="vram">VRAM Allocation (High-Low)</option>
              </select>
            </div>
          </div>

          {/* Right: Refresh Control */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[10px] text-slate-450 font-semibold font-mono hidden sm:inline-block">
              {status ? `Updated: ${new Date(status.timestamp * 1000).toLocaleTimeString()}` : 'Connecting...'}
            </span>

            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-sm">
              {/* Play/Pause Button */}
              <button
                onClick={() => setIsPaused(!isPaused)}
                className={`p-1.5 rounded-md transition-colors ${
                  isPaused ? 'bg-amber-100 text-amber-800' : 'hover:bg-slate-200 text-slate-600'
                }`}
                title={isPaused ? "Resume auto-refresh" : "Pause auto-refresh"}
              >
                {isPaused ? <Play size={12} /> : <Pause size={12} />}
              </button>

              <div className="h-4 w-px bg-slate-200 mx-1" />

              {/* Interval Select */}
              <select
                value={pollInterval}
                onChange={(e) => setPollInterval(Number(e.target.value))}
                disabled={isPaused}
                className="bg-transparent border-0 text-xs font-semibold text-slate-600 focus:outline-none pr-1 cursor-pointer disabled:opacity-50"
              >
                <option value={2}>2s</option>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={30}>30s</option>
              </select>
            </div>
          </div>
        </div>

        {activeTab === 'port-mappings' ? (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
              TCP Port Forwarding Mappings
            </h3>
            <PortMappingsView hosts={status?.hosts.map(h => ({ name: h.name, ip: h.ip })) ?? []} />
          </div>
        ) : (
          <>
            {/* 1. Server Cards Grid Section */}
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {activeTab === 'attention' ? 'Attention Needed List' : activeTab === 'a6000' ? 'A6000 Nodes' : activeTab === 'rtx4090' ? 'RTX 4090 Nodes' : 'All Cluster Servers'}
                </h3>
                <span className="text-xs text-slate-400 font-semibold">{filteredHosts.length} items</span>
              </div>

              {status ? (
                <HostCardsGrid
                  hosts={filteredHosts}
                  selectedHost={selectedHost}
                  onSelect={setSelectedHost}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 border border-slate-200 rounded-xl bg-white shadow-sm">
                  <RefreshCw size={24} className="animate-spin text-indigo-600 mb-3" />
                  <span className="text-sm text-slate-400 font-medium">Fetching live server status...</span>
                </div>
              )}
            </div>

            {/* Horizontal Divider */}
            {status && <div className="border-t border-slate-200 my-2" />}

            {/* 2. Selected Server Detailed Workspace */}
            {status && activeHostData && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">
                  {activeTab === 'attention' ? `Attention Needed Diagnostics: ${activeHostData.name}` : `Active Server Analytics: ${activeHostData.name}`}
                </h3>
                {activeTab === 'attention' ? (
                  <HostWarningDetailsView
                    host={activeHostData}
                    pollSeconds={status?.poll_seconds ?? 2}
                  />
                ) : (
                  <HostDetailsView
                    host={activeHostData}
                    cpuHistory={activeHostData.history?.cpu ?? []}
                    gpuHistory={activeHostData.history?.gpu ?? []}
                    pollSeconds={status?.poll_seconds ?? 2}
                    onSelectAlertsTab={() => setActiveTab('attention')}
                  />
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// SidebarItem Component for navigation links
type SidebarItemProps = {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  count?: number;
  onClick: () => void;
  isWarning?: boolean;
  hideCount?: boolean;
};

function SidebarItem({ icon, label, active, count = 0, onClick, isWarning = false, hideCount = false }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 border-l-2 ${
        active
          ? 'border-indigo-650 text-indigo-600 bg-indigo-50/40 font-bold'
          : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
      }`}
    >
      <span className={active ? 'text-indigo-600' : 'text-slate-400'}>{icon}</span>
      <span>{label}</span>
      {!hideCount && (
        <span
          className={`ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold font-mono border ${
            active
              ? 'bg-indigo-100 text-indigo-600 border-indigo-200/50'
              : isWarning
              ? 'bg-rose-50 text-rose-600 border-rose-100'
              : 'bg-slate-50 text-slate-400 border-slate-100'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

type PortProxyMapping = {
  listen_address: string;
  listen_port: number;
  connect_address: string;
  connect_port: number;
};

function PortMappingsView({ hosts }: { hosts: { name: string; ip: string }[] }) {
  const [mappings, setMappings] = useState<PortProxyMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [listenAddress, setListenAddress] = useState('100.99.99.99');
  const [listenPort, setListenPort] = useState('');
  const [connectAddress, setConnectAddress] = useState('');
  const [connectPort, setConnectPort] = useState('11433');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize connectAddress to the first host's IP
  useEffect(() => {
    if (hosts.length > 0 && !connectAddress) {
      setConnectAddress(hosts[0].ip);
    }
  }, [hosts, connectAddress]);

  const loadMappings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portproxy');
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json() as PortProxyMapping[];
      setMappings(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMappings();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listenPort || !connectAddress || !connectPort) {
      setSubmitError("Please fill in all fields.");
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
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
      setListenPort('');
      setSubmitError(null);
      loadMappings();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (listenAddress: string, listenPort: number) => {
    if (!window.confirm(`Are you sure you want to delete mapping on port ${listenPort}?`)) return;
    try {
      const res = await fetch('/api/portproxy/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listen_address: listenAddress,
          listen_port: listenPort
        })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `${res.status} ${res.statusText}`);
      }
      loadMappings();
    } catch (e) {
      alert(`Delete failed: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* List Card */}
      <section className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col min-h-[350px]">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-800">Active Port Mappings</h3>
          <p className="text-xs text-slate-400 mt-0.5">Windows netsh TCP ipv4 interface portproxy rules.</p>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <span className="text-xs text-slate-400">Loading port proxy list...</span>
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center py-10 text-rose-500 text-xs font-semibold">
            Error: {error}
          </div>
        ) : mappings.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-10 text-slate-400 text-xs italic">
            No active port mappings configured.
          </div>
        ) : (
          <div className="overflow-x-auto w-full flex-1 min-h-0">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="text-slate-400 font-bold border-b border-slate-200/50 font-sans">
                  <th className="pb-2 font-semibold">Listen IP</th>
                  <th className="pb-2 font-semibold">Listen Port</th>
                  <th className="pb-2 font-semibold">Target Node IP</th>
                  <th className="pb-2 font-semibold">Target Port</th>
                  <th className="pb-2 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {mappings.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 text-slate-650">{m.listen_address}</td>
                    <td className="py-2.5 text-slate-800 font-bold">{m.listen_port}</td>
                    <td className="py-2.5 text-slate-650">{m.connect_address}</td>
                    <td className="py-2.5 text-slate-600">{m.connect_port}</td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(m.listen_address, m.listen_port)}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add Mapping Card */}
      <section className="lg:col-span-1 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-sm font-bold text-slate-800">Add Port Proxy</h3>
          <p className="text-xs text-slate-400 mt-0.5">Register a new network mapping.</p>
        </div>

        <form onSubmit={handleAdd} className="space-y-4 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Listen IP</label>
            <input
              type="text"
              value={listenAddress}
              onChange={(e) => setListenAddress(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              placeholder="e.g. 100.99.99.99 or 0.0.0.0"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Listen Port</label>
            <input
              type="number"
              value={listenPort}
              onChange={(e) => setListenPort(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold"
              placeholder="e.g. 11449"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Node</label>
            <select
              value={connectAddress}
              onChange={(e) => setConnectAddress(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            >
              {hosts.map((h) => (
                <option key={h.ip} value={h.ip}>
                  {h.name} ({h.ip})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Port</label>
            <input
              type="number"
              value={connectPort}
              onChange={(e) => setConnectPort(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              placeholder="11433"
              required
            />
          </div>

          {submitError && (
            <div className="text-rose-500 text-[10px] font-semibold bg-rose-50 border border-rose-100 p-2 rounded">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? "Creating..." : "Add Mapping"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default App;
