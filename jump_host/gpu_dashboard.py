#!/usr/bin/env python3
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen

BASE_DIR = Path(__file__).resolve().parent.parent
CONFIG_PATH = Path(os.environ.get("LAB_MANAGER_CONFIG", BASE_DIR / "config" / "hosts.json"))
if not CONFIG_PATH.exists():
    CONFIG_PATH = BASE_DIR / "config" / "hosts.example.json"

DEFAULT_CONFIG = {
    "dashboard": {"bind_host": "0.0.0.0", "bind_port": 18080, "poll_seconds": 2, "agent_port": 18180},
    "hosts": [],
}

HTML = r'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GPU Server Dashboard</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#142033;background:#f7f9fc;--line:#e7ecf3;--muted:#738195;--blue:#286bf4;--green:#11a06a;--amber:#c98212;--red:#d94d4d;--soft:#fbfcfe}
    *{box-sizing:border-box} body{margin:0}.shell{min-height:100vh;display:grid;grid-template-columns:236px minmax(0,1fr)}
    aside{background:white;border-right:1px solid var(--line);padding:22px 18px;display:flex;flex-direction:column;gap:24px}.brand{display:flex;align-items:center;gap:10px;font-weight:760}.mark{width:32px;height:32px;border-radius:8px;background:var(--blue);color:white;display:grid;place-items:center;font-weight:800}.nav{display:grid;gap:5px}.nav span{padding:9px 10px;border-radius:8px;color:#5c6878;font-size:13px;font-weight:600}.nav .active{background:#e9f0ff;color:var(--blue)}.side-card{margin-top:auto;border:1px solid var(--line);border-radius:8px;padding:13px;background:var(--soft);color:var(--muted);font-size:12px;line-height:1.45}.side-card strong{display:block;color:#142033;font-size:13px;margin-bottom:5px}
    main{padding:26px 30px 32px;min-width:0}.topbar{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:22px}h1{margin:0;font-size:28px;line-height:1.12}.subtitle{margin-top:7px;color:var(--muted);font-size:14px}.actions{display:flex;gap:10px}.pill{border:1px solid var(--line);background:#fff;border-radius:999px;padding:8px 12px;color:#536174;font-size:12px}.dot{width:7px;height:7px;display:inline-block;border-radius:999px;background:var(--green);margin-right:7px}
    .panel{background:white;border:1px solid var(--line);border-radius:8px;box-shadow:0 18px 45px rgba(28,43,70,.08);overflow:hidden}.panel-head{padding:16px 18px;border-bottom:1px solid var(--line)}.panel-title{font-size:14px;font-weight:720}.panel-subtitle{color:var(--muted);font-size:12px;margin-top:3px}
    table{width:100%;border-collapse:separate;border-spacing:0 12px;font-size:13px;table-layout:fixed}thead th{text-align:left;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:12px 18px;background:#fbfcfe;border-bottom:1px solid var(--line)}tbody td{padding:13px 18px;vertical-align:middle}.server-main{cursor:pointer}.server-main td{background:#fff;border-top:1px solid var(--line);border-bottom:1px solid var(--line);transition:background .18s ease}.server-main:hover td{background:#fbfcff}.server-main td:first-child{border-left:1px solid var(--line);border-radius:8px 0 0 8px}.server-main td:last-child{border-right:1px solid var(--line);border-radius:0 8px 8px 0}
    .server{display:flex;gap:10px;align-items:center;min-width:170px}.server-dot{width:9px;height:9px;border-radius:99px;background:var(--green);box-shadow:0 0 0 4px #e8f8f1}.server-dot.busy{background:var(--amber);box-shadow:0 0 0 4px #fff5df}.server-dot.down{background:var(--red);box-shadow:0 0 0 4px #fff0f0}.server strong{display:block}.server span{display:block;color:var(--muted);font-size:12px;margin-top:2px}.chev{margin-left:auto;color:var(--muted);transition:transform .22s ease}.expanded .chev{transform:rotate(90deg)}
    .badge{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font-size:12px;font-weight:700;white-space:nowrap}.ok{background:#e8f8f1;color:var(--green)}.busy{background:#fff5df;color:var(--amber)}.down{background:#fff0f0;color:var(--red)}.usage strong{display:block;color:#263346;font-size:13px;margin-bottom:6px}.usage span{color:var(--muted);font-size:12px}.thin-track{margin-top:6px;height:6px;border-radius:999px;background:#edf2f8;overflow:hidden}.thin-fill{height:100%;border-radius:inherit;background:var(--blue);transition:width .45s ease}.error{color:var(--red);font-size:12px}
    .process-row td{padding:0 18px 18px!important;background:transparent;border:0}.process-wrap{max-height:min(430px,42vh);overflow:auto;padding:4px 4px 8px;animation:reveal .22s ease both}@keyframes reveal{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}.user-block{border:1px solid var(--line);background:var(--user-bg,#fbfcfe);border-radius:8px;margin-top:8px;overflow:hidden}.user-head{display:flex;justify-content:space-between;gap:12px;padding:9px 11px;border-bottom:1px solid rgba(115,129,149,.18);color:#39465a;font-size:12px;font-weight:700}.user-head span{color:var(--muted);font-weight:600}.user-chip{display:inline-flex;align-items:center;gap:7px}.user-chip:before{content:"";width:8px;height:8px;border-radius:99px;background:var(--user-accent,var(--blue))}.process-table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}.process-table th{padding:7px 10px;background:rgba(255,255,255,.62);color:var(--muted);font-size:10px;text-align:left}.process-table td{padding:8px 10px;background:rgba(255,255,255,.38);border-bottom:1px solid rgba(115,129,149,.16)}.process-table th:nth-child(1),.process-table td:nth-child(1){width:78px}.process-table th:nth-child(2),.process-table td:nth-child(2),.process-table th:nth-child(3),.process-table td:nth-child(3){width:70px}.process-table th:nth-child(4),.process-table td:nth-child(4){width:90px}.cmd{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#48566a}.empty{color:var(--muted);font-size:12px;padding:10px 0 0}.detail-section{border:1px solid var(--line);background:#fff;border-radius:8px;margin-top:8px;overflow:hidden}.detail-title{display:flex;justify-content:space-between;gap:12px;padding:9px 11px;border-bottom:1px solid rgba(115,129,149,.18);color:#39465a;font-size:12px;font-weight:700}.disk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;padding:10px}.disk-item{background:#fbfcfe;border:1px solid rgba(115,129,149,.16);border-radius:8px;padding:9px 10px}.disk-item strong{display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.disk-item span{display:block;color:var(--muted);font-size:12px;margin-top:4px}.user-disk{color:#536174;font-weight:700;margin-left:6px}
    @media(max-width:1050px){.shell{grid-template-columns:1fr}aside{display:none}main{padding:20px}}@media(max-width:720px){.topbar{flex-direction:column}table,thead,tbody,tr,th,td{display:block}thead{display:none}tbody td{padding:7px 16px}.server-main{border-bottom:1px solid var(--line)}.process-row td{padding:0 12px 16px!important}}
  </style>
</head>
<body>
<div class="shell"><aside><div class="brand"><div class="mark">G</div><span>GPU Ops</span></div><div class="nav"><span class="active">Overview</span><span>A6000 Cluster</span><span>RTX 4090 Cluster</span><span>Processes</span><span>Tunnels</span></div><div class="side-card"><strong>Live agent mode</strong>Status is read through persistent local SSH tunnels on the Windows jump host.</div></aside><main><div class="topbar"><div><h1>GPU Server Dashboard</h1><div class="subtitle">Live utilization, memory pressure, and process ownership across the lab fleet.</div></div><div class="actions"><div class="pill"><span class="dot"></span><span id="meta">Loading</span></div><div class="pill">Refresh <span id="poll">2</span>s</div></div></div><section class="panel"><div class="panel-head"><div class="panel-title">Server details</div><div class="panel-subtitle">CPU, memory, disk, GPU, VRAM, users, per-user disk, and processes</div></div><div id="table"></div></section></main></div>
<script>
const meta=document.getElementById("meta"),table=document.getElementById("table"),poll=document.getElementById("poll");const expanded=new Set(),rows=new Map();let latest=null;const palette=[["#eef6ff","#2f6fed"],["#effaf4","#13a56f"],["#fff7e8","#c98212"],["#f5f0ff","#7b61ff"],["#fff1f5","#d84b7a"],["#eefaf9","#0e9f9a"],["#f4f6fa","#60708a"],["#fff4ef","#d46b3d"]];
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}function pct(a,b){return b?Math.max(0,Math.min(100,a*100/b)):0}function mb(v){return v>=1024?(v/1024).toFixed(1)+" GB":(v||0)+" MB"}function st(h){if(h.error||!h.gpu)return"down";const m=pct(h.gpu.mem_used_mb||0,h.gpu.mem_total_mb||0),c=h.cpu?(h.cpu.util_pct??pct(h.cpu.load1,h.cpu.cpus)):0;return(h.gpu.util_gpu>=50||m>=50||c>=70)?"busy":"ok"}function cls(el,c){if(el&&el.className!==c)el.className=c}function html(el,v){if(el&&el.innerHTML!==v)el.innerHTML=v}function userColor(u){let h=0;for(const ch of String(u||""))h=((h<<5)-h+ch.charCodeAt(0))|0;return palette[Math.abs(h)%palette.length]}
function ensureUsage(el){if(!el.querySelector(".usage"))el.innerHTML='<div class="usage"><strong></strong><span></span><div class="thin-track"><div class="thin-fill"></div></div></div>'}function usage(el,value,caption,width){ensureUsage(el);const s=el.querySelector("strong"),sp=el.querySelector("span"),f=el.querySelector(".thin-fill"),vt=`${value}%`,wt=`${Math.max(0,Math.min(100,width))}%`;if(s.textContent!==vt)s.textContent=vt;if(sp.textContent!==caption)sp.textContent=caption;if(f.style.width!==wt)f.style.width=wt}
function diskSections(h){const disks=h.disks||[],users=h.user_disk||[];let out="";if(disks.length){out+=`<div class="detail-section"><div class="detail-title">Disk volumes<span>${disks.length} mount${disks.length>1?"s":""}</span></div><div class="disk-grid">${disks.map(d=>`<div class="disk-item"><strong>${esc(d.target||d.source)}</strong><span>${mb(d.used_mb||0)} / ${mb(d.size_mb||0)} used (${d.use_pct||0}%)</span><div class="thin-track"><div class="thin-fill" style="width:${Math.max(0,Math.min(100,d.use_pct||0))}%"></div></div></div>`).join("")}</div></div>`}if(users.length){out+=`<div class="detail-section"><div class="detail-title">Home directory usage<span>cached up to 5 min</span></div><div class="disk-grid">${users.map(u=>`<div class="disk-item"><strong>${esc(u.user)}</strong><span>${mb(u.used_mb||0)}</span></div>`).join("")}</div></div>`}return out}
function grouped(h){const userDisk=new Map((h.user_disk||[]).map(u=>[u.user,u.used_mb]));const groups=new Map();for(const p of h.processes||[]){const u=p.user||"unknown";if(!groups.has(u))groups.set(u,[]);groups.get(u).push(p)}const processHtml=groups.size?Array.from(groups.entries()).map(([u,ps])=>{const [bg,ac]=userColor(u),gpu=ps.reduce((a,p)=>a+(Number(p.gpu_mem_mb)||0),0),cpu=ps.reduce((a,p)=>a+(Number(p.cpu)||0),0).toFixed(1);return `<div class="user-block" style="--user-bg:${bg};--user-accent:${ac}"><div class="user-head"><div class="user-chip">${esc(u)}${userDisk.has(u)?`<span class="user-disk">${mb(userDisk.get(u))}</span>`:""}</div><span>${ps.length} process${ps.length>1?"es":""} / CPU ${cpu}% / GPU ${gpu?mb(gpu):"-"}</span></div><table class="process-table"><thead><tr><th>PID</th><th>CPU</th><th>MEM</th><th>GPU MEM</th><th>COMMAND</th></tr></thead><tbody>${ps.map(p=>`<tr><td>${esc(p.pid||"-")}</td><td>${esc(p.cpu||"-")}%</td><td>${esc(p.mem||"-")}%</td><td>${p.gpu_mem_mb?mb(p.gpu_mem_mb):"-"}</td><td><div class="cmd" title="${esc(p.cmd||p.process||"")}">${esc(p.cmd||p.process||"")}</div></td></tr>`).join("")}</tbody></table></div>`}).join(""):"";return diskSections(h)+processHtml+(groups.size?"":"<div class=\"empty\">No active process reported.</div>")}
function init(){if(table.querySelector("tbody"))return;table.innerHTML='<table><thead><tr><th>Server</th><th>Status</th><th>CPU usage</th><th>System memory</th><th>Disk usage</th><th>GPU usage</th><th>VRAM usage</th><th>Users and processes</th></tr></thead><tbody id="body"></tbody></table>'}
function create(h){const tr=document.createElement("tr");tr.className="server-main";tr.dataset.server=h.name;tr.innerHTML='<td><div class="server"><span class="server-dot"></span><div><strong></strong><span class="server-meta"></span></div><span class="chev">&rsaquo;</span></div></td><td class="status-cell"></td><td class="cpu-cell"></td><td class="mem-cell"></td><td class="disk-cell"></td><td class="gpu-cell"></td><td class="vram-cell"></td><td class="users-cell"></td>';tr.addEventListener("click",()=>{const n=tr.dataset.server;expanded.has(n)?expanded.delete(n):expanded.add(n);expand(n)});rows.set(h.name,{row:tr,detail:null,sig:""});return tr}
function expand(name){const rec=rows.get(name),h=(latest?.hosts||[]).find(x=>x.name===name);if(!rec||!h)return;rec.row.classList.toggle("expanded",expanded.has(name));if(!expanded.has(name)){if(rec.detail)rec.detail.remove();rec.detail=null;return}if(!rec.detail){rec.detail=document.createElement("tr");rec.detail.className="process-row";rec.detail.innerHTML='<td colspan="8"><div class="process-wrap"></div></td>';rec.row.after(rec.detail)}const sig=JSON.stringify(h.processes||[]);if(rec.sig!==sig){html(rec.detail.querySelector(".process-wrap"),grouped(h));rec.sig=sig}}
function render(data){init();latest=data;poll.textContent=data.poll_seconds||2;meta.textContent=`Updated ${new Date(data.timestamp*1000).toLocaleTimeString()}`;const body=document.getElementById("body"),seen=new Set();for(const h of data.hosts||[]){seen.add(h.name);let rec=rows.get(h.name);if(!rec){body.appendChild(create(h));rec=rows.get(h.name)}else{body.appendChild(rec.row);if(rec.detail)body.appendChild(rec.detail)}const open=expanded.has(h.name);cls(rec.row,`server-main ${open?"expanded":""}`);html(rec.row.querySelector(".server strong"),esc(h.name));html(rec.row.querySelector(".server-meta"),`${esc(h.group)} / ${esc(h.ip)} / :${h.port}`);if(!h.gpu){cls(rec.row.querySelector(".server-dot"),"server-dot down");html(rec.row.querySelector(".status-cell"),'<span class="badge down">down</span>');html(rec.row.querySelector(".cpu-cell"),`<span class="error">${esc(h.error||"offline")}</span>`);html(rec.row.querySelector(".mem-cell"),"");html(rec.row.querySelector(".disk-cell"),"");html(rec.row.querySelector(".gpu-cell"),"");html(rec.row.querySelector(".vram-cell"),"");html(rec.row.querySelector(".users-cell"),"");expand(h.name);continue}const state=st(h),cpu=Math.round(h.cpu?(h.cpu.util_pct??pct(h.cpu.load1,h.cpu.cpus)):0),mu=h.memory?h.memory.used_mb:0,mt=h.memory?h.memory.total_mb:0,mp=Math.round(pct(mu,mt)),rootDisk=(h.disks||[]).find(d=>d.target==="/")||(h.disks||[])[0]||{},dp=Math.round(rootDisk.use_pct||0),gp=h.gpu.util_gpu||0,vp=Math.round(pct(h.gpu.mem_used_mb||0,h.gpu.mem_total_mb||0)),uc=h.processes&&h.processes.length?new Set(h.processes.map(p=>p.user||"unknown")).size:0;cls(rec.row.querySelector(".server-dot"),`server-dot ${state==="busy"?"busy":""}`);html(rec.row.querySelector(".status-cell"),`<span class="badge ${state}">${state==="ok"?"idle":state}</span>`);usage(rec.row.querySelector(".cpu-cell"),cpu,`load ${h.cpu?h.cpu.load1.toFixed(2):"-"} / ${h.cpu?h.cpu.cpus:"-"} cores`,cpu);usage(rec.row.querySelector(".mem-cell"),mp,`${mb(mu)} / ${mb(mt)}`,mp);usage(rec.row.querySelector(".disk-cell"),dp,`${mb(rootDisk.used_mb||0)} / ${mb(rootDisk.size_mb||0)} ${rootDisk.target||"disk"}`,dp);usage(rec.row.querySelector(".gpu-cell"),gp,`${h.gpu.name||"GPU"} / ${h.gpu.temp_c||"-"} C`,gp);usage(rec.row.querySelector(".vram-cell"),vp,`${mb(h.gpu.mem_used_mb||0)} / ${mb(h.gpu.mem_total_mb||0)}`,vp);html(rec.row.querySelector(".users-cell"),`<span class="badge ${state}">${uc?`${uc} users`:"no process"}</span>`);expand(h.name)}for(const [n,r]of rows.entries())if(!seen.has(n)){if(r.detail)r.detail.remove();r.row.remove();rows.delete(n);expanded.delete(n)}}
async function refresh(){try{const r=await fetch("/api/status",{cache:"no-store"});render(await r.json())}catch(e){meta.textContent="Update failed"}}refresh();setInterval(refresh,2000);
</script>
</body>
</html>'''

def load_config():
    if CONFIG_PATH.exists():
        with CONFIG_PATH.open("r", encoding="utf-8-sig") as f:
            data = json.load(f)
    else:
        data = DEFAULT_CONFIG
    dashboard = {**DEFAULT_CONFIG["dashboard"], **data.get("dashboard", {})}
    hosts = []
    for h in data.get("hosts", []):
        item = dict(h)
        item["port"] = int(item.get("local_port", item.get("port", dashboard["agent_port"])))
        hosts.append(item)
    return dashboard, hosts

def section(lines, marker):
    try:
        start = lines.index(marker) + 1
    except ValueError:
        return []
    end = len(lines)
    for i in range(start, len(lines)):
        if lines[i].startswith("__") and lines[i].endswith("__"):
            end = i
            break
    return lines[start:end]

def parse_output(base, out):
    lines = [x.rstrip() for x in out.splitlines()]
    gpu_lines = section(lines, "__GPU__")
    if gpu_lines:
        parts = [x.strip() for x in gpu_lines[0].split(",")]
        if len(parts) >= 7:
            base["gpu"] = {"index": int(parts[0]), "name": parts[1], "mem_used_mb": int(parts[2]), "mem_total_mb": int(parts[3]), "util_gpu": int(parts[4]), "util_mem": int(parts[5]), "temp_c": int(parts[6])}
    mem_lines = section(lines, "__MEM__")
    if mem_lines:
        parts = [int(float(x.strip())) for x in mem_lines[0].split(",")[:3]]
        base["memory"] = {"total_mb": parts[0], "used_mb": parts[1], "available_mb": parts[2]}
    disks = []
    for line in section(lines, "__DISK__"):
        parts = [x.strip() for x in line.split(",")]
        if len(parts) >= 6:
            try:
                disks.append({"source": parts[0], "target": parts[1], "size_mb": int(parts[2]), "used_mb": int(parts[3]), "available_mb": int(parts[4]), "use_pct": int(parts[5])})
            except ValueError:
                pass
    base["disks"] = disks
    user_disk = []
    for line in section(lines, "__USER_DISK__"):
        parts = [x.strip() for x in line.split(",")]
        if len(parts) >= 2:
            try:
                user_disk.append({"user": parts[0], "used_mb": int(parts[1])})
            except ValueError:
                pass
    base["user_disk"] = user_disk
    load_lines = section(lines, "__LOAD__")
    if load_lines:
        parts = [x.strip() for x in load_lines[0].split(",")]
        if len(parts) >= 4:
            base["cpu"] = {"load1": float(parts[0]), "load5": float(parts[1]), "load15": float(parts[2]), "cpus": int(float(parts[3]))}
    cpu_lines = section(lines, "__CPU__")
    if cpu_lines:
        try:
            base.setdefault("cpu", {})["util_pct"] = float(cpu_lines[0].strip())
        except ValueError:
            pass
    gpu_proc = {}
    for line in section(lines, "__GPU_PROC__"):
        parts = [x.strip() for x in line.split(",")]
        if len(parts) >= 3 and parts[0].isdigit():
            gpu_proc[parts[0]] = {"process": parts[1], "gpu_mem_mb": int(parts[2])}
    procs = []
    for line in section(lines, "__TOP__"):
        parts = line.split(None, 6)
        if len(parts) >= 7:
            p = {"pid": parts[0], "user": parts[1], "cpu": parts[2], "mem": parts[3], "rss_kb": parts[4], "comm": parts[5], "cmd": parts[6]}
            if parts[0] in gpu_proc:
                p.update(gpu_proc[parts[0]])
            procs.append(p)
    for pid, gp in gpu_proc.items():
        if not any(p["pid"] == pid for p in procs):
            procs.append({"pid": pid, **gp})
    base["processes"] = procs
    return base

def get_status():
    dashboard, hosts_config = load_config()
    timestamp = time.time()

    def fetch(h):
        item = dict(h)
        try:
            with urlopen(f"http://127.0.0.1:{h['port']}/status", timeout=18) as resp:
                text = resp.read().decode("utf-8", errors="replace")
            if "__GPU__" in text:
                return parse_output(item, text)
            item["error"] = text[-400:]
        except Exception as exc:
            item["error"] = str(exc)
        return item

    max_workers = max(1, len(hosts_config))
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        hosts = list(pool.map(fetch, hosts_config))
    return {"timestamp": timestamp, "poll_seconds": dashboard.get("poll_seconds", 2), "hosts": sorted(hosts, key=lambda x: (x.get("group", ""), x.get("name", "")))}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/" or self.path.startswith("/index"):
            body = HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.startswith("/api/status"):
            body = json.dumps(get_status()).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(404)

    def log_message(self, fmt, *args):
        return

if __name__ == "__main__":
    dashboard, _ = load_config()
    server = ThreadingHTTPServer((dashboard["bind_host"], int(dashboard["bind_port"])), Handler)
    print(f"Serving dashboard on http://{dashboard['bind_host']}:{dashboard['bind_port']} using {CONFIG_PATH}")
    server.serve_forever()



