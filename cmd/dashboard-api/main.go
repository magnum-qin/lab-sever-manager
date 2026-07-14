package main

import (
	"bufio"
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Config struct {
	Dashboard DashboardConfig `json:"dashboard"`
	Hosts     []HostConfig    `json:"hosts"`
}

type DashboardConfig struct {
	BindHost    string `json:"bind_host"`
	BindPort    int    `json:"bind_port"`
	PollSeconds int    `json:"poll_seconds"`
	AgentPort   int    `json:"agent_port"`
	AgentToken  string `json:"agent_token"`
	StaticDir   string `json:"static_dir"`
}

type HostConfig struct {
	Name      string `json:"name"`
	IP        string `json:"ip"`
	Group     string `json:"group"`
	AgentPort int    `json:"agent_port"`
	Port      int    `json:"port"`
}

type StatusResponse struct {
	Timestamp   float64      `json:"timestamp"`
	PollSeconds int          `json:"poll_seconds"`
	Summary     Summary      `json:"summary"`
	Hosts       []HostStatus `json:"hosts"`
}

type Summary struct {
	Total    int `json:"total"`
	Online   int `json:"online"`
	Busy     int `json:"busy"`
	Down     int `json:"down"`
	Warnings int `json:"warnings"`
}

type HostHistory struct {
	CPU []int `json:"cpu"`
	GPU []int `json:"gpu"`
}

type HostStatus struct {
	Name           string        `json:"name"`
	IP             string        `json:"ip"`
	Group          string        `json:"group"`
	Port           int           `json:"port"`
	Error          string        `json:"error,omitempty"`
	AgentReachable bool          `json:"agent_reachable"`
	GPU            *GPU          `json:"gpu,omitempty"`
	GPUs           []GPU         `json:"gpus,omitempty"`
	Memory         *Memory       `json:"memory,omitempty"`
	CPU            *CPU          `json:"cpu,omitempty"`
	Disks          []Disk        `json:"disks"`
	UserDisk       []UserDisk    `json:"user_disk"`
	UserTmpDisk    []UserDisk    `json:"user_tmp_disk"`
	Logins         []LoginInfo   `json:"logins"`
	Processes      []ProcessInfo `json:"processes"`
	State          string        `json:"state"`
	Alerts         []Alert       `json:"alerts"`
	History        *HostHistory  `json:"history,omitempty"`
}

type GPU struct {
	Index      int    `json:"index"`
	Name       string `json:"name"`
	MemUsedMB  int    `json:"mem_used_mb"`
	MemTotalMB int    `json:"mem_total_mb"`
	UtilGPU    int    `json:"util_gpu"`
	UtilMem    int    `json:"util_mem"`
	TempC      int    `json:"temp_c"`
}

type Memory struct {
	TotalMB     int `json:"total_mb"`
	UsedMB      int `json:"used_mb"`
	AvailableMB int `json:"available_mb"`
}

type CPU struct {
	Load1   float64  `json:"load1"`
	Load5   float64  `json:"load5"`
	Load15  float64  `json:"load15"`
	CPUs    int      `json:"cpus"`
	UtilPct *float64 `json:"util_pct,omitempty"`
}

type Disk struct {
	Source      string `json:"source"`
	Target      string `json:"target"`
	SizeMB      int    `json:"size_mb"`
	UsedMB      int    `json:"used_mb"`
	AvailableMB int    `json:"available_mb"`
	UsePct      int    `json:"use_pct"`
}

type UserDisk struct {
	User   string `json:"user"`
	UsedMB int    `json:"used_mb"`
}

type LoginInfo struct {
	User string `json:"user"`
	TTY  string `json:"tty"`
	Host string `json:"host"`
	Time string `json:"time"`
}

type ProcessInfo struct {
	PID      string `json:"pid"`
	User     string `json:"user,omitempty"`
	CPU      string `json:"cpu,omitempty"`
	Mem      string `json:"mem,omitempty"`
	RSSKB    string `json:"rss_kb,omitempty"`
	Comm     string `json:"comm,omitempty"`
	Cmd      string `json:"cmd,omitempty"`
	Process  string `json:"process,omitempty"`
	GPUMemMB int    `json:"gpu_mem_mb,omitempty"`
}

type Alert struct {
	Level   string `json:"level"`
	Message string `json:"message"`
}

type WinDiskInfo struct {
	DeviceID  string `json:"DeviceID"`
	Size      int64  `json:"Size"`
	FreeSpace int64  `json:"FreeSpace"`
}

type WinProcessInfo struct {
	ID          int      `json:"Id"`
	ProcessName string   `json:"ProcessName"`
	CPU         *float64 `json:"CPU"`
	WorkingSet  int64    `json:"WorkingSet64"`
}

type JumpHostStatus struct {
	CPUUtilPct   int              `json:"cpu_util_pct"`
	MemTotalKB   int64            `json:"mem_total_kb"`
	MemFreeKB    int64            `json:"mem_free_kb"`
	OSName       string           `json:"os_name"`
	LastBootTime string           `json:"last_boot_time"`
	Disks        []WinDiskInfo    `json:"disks"`
	Processes    []WinProcessInfo `json:"processes"`
	Users        string           `json:"users"`
}

type app struct {
	configPath  string
	staticDir   string
	client      *http.Client
	mu          sync.RWMutex
	last        StatusResponse
	lastFetched time.Time
	history     map[string]*HostHistory
}

func main() {
	root, _ := os.Getwd()
	configPath := getenv("LAB_MANAGER_CONFIG", filepath.Join(root, "config", "hosts.json"))
	if _, err := os.Stat(configPath); errors.Is(err, os.ErrNotExist) {
		configPath = filepath.Join(root, "config", "hosts.example.json")
	}
	cfg, err := loadConfig(configPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	tokenOverride := os.Getenv("DASHBOARD_AGENT_TOKEN")
	if tokenOverride != "" {
		cfg.Dashboard.AgentToken = tokenOverride
	}
	bindHost := fallback(cfg.Dashboard.BindHost, "0.0.0.0")
	bindPort := cfg.Dashboard.BindPort
	if bindPort == 0 {
		bindPort = 18080
	}
	staticDir := cfg.Dashboard.StaticDir
	if staticDir == "" {
		staticDir = filepath.Join(root, "apps", "dashboard-web", "dist")
	}
	api := &app{
		configPath: configPath,
		staticDir:  staticDir,
		client:     &http.Client{Timeout: 18 * time.Second},
		history:    make(map[string]*HostHistory),
	}
	go api.startPoller(context.Background())

	mux := http.NewServeMux()
	mux.HandleFunc("/api/status", api.handleStatus)
	mux.HandleFunc("/api/events", api.handleEvents)
	mux.HandleFunc("/api/portproxy", api.handlePortProxy)
	mux.HandleFunc("/api/portproxy/add", api.handlePortProxyAdd)
	mux.HandleFunc("/api/portproxy/delete", api.handlePortProxyDelete)
	mux.HandleFunc("/api/unsloth/status", api.handleUnslothStatus)
	mux.HandleFunc("/api/unsloth/control", api.handleUnslothControl)
	mux.HandleFunc("/api/unsloth/models", api.handleUnslothModels)
	mux.HandleFunc("/api/jump-host/status", api.handleJumpHostStatus)
	mux.HandleFunc("/api/palworld/settings", api.handlePalworldSettings)
	mux.HandleFunc("/api/palworld/settings/save", api.handlePalworldSettingsSave)
	mux.HandleFunc("/api/palworld/control", api.handlePalworldControl)
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("ok\n")) })
	mux.HandleFunc("/", api.handleStatic)

	addr := fmt.Sprintf("%s:%d", bindHost, bindPort)
	log.Printf("dashboard-api listening on http://%s using %s static=%s", addr, configPath, staticDir)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func (a *app) handleStatus(w http.ResponseWriter, r *http.Request) {
	a.mu.RLock()
	resp := a.last
	lastFetched := a.lastFetched
	a.mu.RUnlock()

	if lastFetched.IsZero() {
		cfg, err := loadConfig(a.configPath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if v := os.Getenv("DASHBOARD_AGENT_TOKEN"); v != "" {
			cfg.Dashboard.AgentToken = v
		}
		resp = a.collect(r.Context(), cfg)
	}

	writeJSON(w, resp)
}

func (a *app) handleEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Connection", "keep-alive")
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "stream unsupported", http.StatusInternalServerError)
		return
	}
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		a.mu.RLock()
		resp := a.last
		a.mu.RUnlock()

		body, _ := json.Marshal(resp)
		_, _ = fmt.Fprintf(w, "event: status\ndata: %s\n\n", body)
		flusher.Flush()

		select {
		case <-r.Context().Done():
			return
		case <-ticker.C:
		}
	}
}

func (a *app) startPoller(ctx context.Context) {
	// First fetch immediately at startup to avoid empty cache
	cfg, err := loadConfig(a.configPath)
	if err == nil {
		if v := os.Getenv("DASHBOARD_AGENT_TOKEN"); v != "" {
			cfg.Dashboard.AgentToken = v
		}
		resp := a.collect(ctx, cfg)
		
		a.mu.Lock()
		a.updateHistoryAndCache(resp, cfg.Dashboard.PollSeconds)
		a.mu.Unlock()
	}

	for {
		cfg, err := loadConfig(a.configPath)
		pollSeconds := 2
		if err == nil {
			pollSeconds = cfg.Dashboard.PollSeconds
			if pollSeconds <= 0 {
				pollSeconds = 2
			}
			if v := os.Getenv("DASHBOARD_AGENT_TOKEN"); v != "" {
				cfg.Dashboard.AgentToken = v
			}
			resp := a.collect(ctx, cfg)
			
			a.mu.Lock()
			a.updateHistoryAndCache(resp, pollSeconds)
			a.mu.Unlock()
		} else {
			log.Printf("poller load config error: %v", err)
		}
		
		time.Sleep(time.Duration(pollSeconds) * time.Second)
	}
}

func (a *app) updateHistoryAndCache(resp StatusResponse, pollSeconds int) {
	for _, h := range resp.Hosts {
		cpu := 0
		if h.CPU != nil {
			if h.CPU.UtilPct != nil {
				cpu = int(*h.CPU.UtilPct)
			} else if h.CPU.CPUs > 0 {
				cpu = int(clamp((h.CPU.Load1/float64(h.CPU.CPUs))*100, 0, 100))
			}
		}
		gpu := 0
		if len(h.GPUs) > 0 {
			sum := 0
			for _, g := range h.GPUs {
				sum += g.UtilGPU
			}
			gpu = sum / len(h.GPUs)
		} else if h.GPU != nil {
			gpu = h.GPU.UtilGPU
		}

		hist, ok := a.history[h.Name]
		if !ok {
			hist = &HostHistory{
				CPU: []int{},
				GPU: []int{},
			}
			a.history[h.Name] = hist
		}
		hist.CPU = append(hist.CPU, cpu)
		hist.GPU = append(hist.GPU, gpu)

		maxPoints := 3600 / pollSeconds
		if maxPoints < 30 {
			maxPoints = 30
		}
		if len(hist.CPU) > maxPoints {
			hist.CPU = hist.CPU[len(hist.CPU)-maxPoints:]
		}
		if len(hist.GPU) > maxPoints {
			hist.GPU = hist.GPU[len(hist.GPU)-maxPoints:]
		}
	}

	for i, h := range resp.Hosts {
		if hist, ok := a.history[h.Name]; ok {
			cpuCopy := make([]int, len(hist.CPU))
			copy(cpuCopy, hist.CPU)
			gpuCopy := make([]int, len(hist.GPU))
			copy(gpuCopy, hist.GPU)
			resp.Hosts[i].History = &HostHistory{
				CPU: cpuCopy,
				GPU: gpuCopy,
			}
		} else {
			resp.Hosts[i].History = &HostHistory{
				CPU: []int{},
				GPU: []int{},
			}
		}
	}

	a.last = resp
	a.lastFetched = time.Now()
}

func (a *app) handleStatic(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		path := filepath.Clean(strings.TrimPrefix(r.URL.Path, "/"))
		candidate := filepath.Join(a.staticDir, path)
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			http.ServeFile(w, r, candidate)
			return
		}
	}
	index := filepath.Join(a.staticDir, "index.html")
	if _, err := os.Stat(index); err == nil {
		http.ServeFile(w, r, index)
		return
	}
	http.Error(w, "frontend build not found; run npm run build in apps/dashboard-web", http.StatusNotFound)
}

func (a *app) collect(ctx context.Context, cfg Config) StatusResponse {
	poll := cfg.Dashboard.PollSeconds
	if poll == 0 {
		poll = 2
	}
	agentPort := cfg.Dashboard.AgentPort
	if agentPort == 0 {
		agentPort = 18180
	}
	results := make([]HostStatus, len(cfg.Hosts))
	var wg sync.WaitGroup
	for i, host := range cfg.Hosts {
		i, host := i, host
		wg.Add(1)
		go func() {
			defer wg.Done()
			port := host.AgentPort
			if port == 0 {
				port = host.Port
			}
			if port == 0 {
				port = agentPort
			}
			results[i] = a.fetchHost(ctx, host, port, cfg.Dashboard.AgentToken)
		}()
	}
	wg.Wait()
	sort.Slice(results, func(i, j int) bool {
		if results[i].Group == results[j].Group {
			return results[i].Name < results[j].Name
		}
		return results[i].Group < results[j].Group
	})
	summary := Summary{Total: len(results)}
	for i := range results {
		results[i].deriveState()
		if results[i].Alerts == nil {
			results[i].Alerts = []Alert{}
		}
		if results[i].Disks == nil {
			results[i].Disks = []Disk{}
		}
		if results[i].UserDisk == nil {
			results[i].UserDisk = []UserDisk{}
		}
		if results[i].UserTmpDisk == nil {
			results[i].UserTmpDisk = []UserDisk{}
		}
		if results[i].Logins == nil {
			results[i].Logins = []LoginInfo{}
		}
		if results[i].Processes == nil {
			results[i].Processes = []ProcessInfo{}
		}
		switch results[i].State {
		case "down":
			summary.Down++
		case "busy":
			summary.Busy++
			summary.Online++
		default:
			summary.Online++
		}
		summary.Warnings += len(results[i].Alerts)
	}
	return StatusResponse{Timestamp: float64(time.Now().UnixMilli()) / 1000, PollSeconds: poll, Summary: summary, Hosts: results}
}

func (a *app) fetchHost(ctx context.Context, host HostConfig, port int, token string) HostStatus {
	status := HostStatus{
		Name:           host.Name,
		IP:             host.IP,
		Group:          host.Group,
		Port:           port,
		Disks:          []Disk{},
		UserDisk:       []UserDisk{},
		UserTmpDisk:    []UserDisk{},
		Logins:         []LoginInfo{},
		Processes:      []ProcessInfo{},
		Alerts:         []Alert{},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("http://%s:%d/status", host.IP, port), nil)
	if err != nil {
		status.Error = err.Error()
		return status
	}
	if token != "" {
		req.Header.Set("X-Agent-Token", token)
	}
	resp, err := a.client.Do(req)
	if err != nil {
		status.Error = err.Error()
		return status
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	status.AgentReachable = true
	if resp.StatusCode >= 300 {
		status.AgentReachable = false
		status.Error = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
		return status
	}
	if err := parseProbeOutput(&status, string(body)); err != nil {
		status.Error = err.Error()
	}
	return status
}

func (h *HostStatus) deriveState() {
	if !h.AgentReachable {
		h.State = "down"
		if h.Error == "" {
			h.Error = "agent is unreachable"
		}
		h.Alerts = append(h.Alerts, Alert{Level: "critical", Message: h.Name + " agent is unreachable"})
		return
	}
	cpuPct := 0.0
	if h.CPU != nil {
		if h.CPU.UtilPct != nil {
			cpuPct = *h.CPU.UtilPct
		} else if h.CPU.CPUs > 0 {
			cpuPct = clamp((h.CPU.Load1/float64(h.CPU.CPUs))*100, 0, 100)
		}
	}
	memPct := 0.0
	if h.Memory != nil && h.Memory.TotalMB > 0 {
		memPct = float64(h.Memory.UsedMB) * 100 / float64(h.Memory.TotalMB)
	}

	// Multi-GPU VRAM calculations
	vramPct := 0.0
	if len(h.GPUs) > 0 {
		totalMem := 0
		usedMem := 0
		for _, g := range h.GPUs {
			totalMem += g.MemTotalMB
			usedMem += g.MemUsedMB
		}
		if totalMem > 0 {
			vramPct = float64(usedMem) * 100 / float64(totalMem)
		}
	} else if h.GPU != nil && h.GPU.MemTotalMB > 0 {
		vramPct = float64(h.GPU.MemUsedMB) * 100 / float64(h.GPU.MemTotalMB)
	}

	diskPct := 0
	for _, d := range h.Disks {
		if d.Target == "/" || diskPct == 0 {
			diskPct = d.UsePct
		}
		if d.UsePct >= 90 {
			h.Alerts = append(h.Alerts, Alert{Level: "warning", Message: fmt.Sprintf("%s disk %s is %d%% used", h.Name, d.Target, d.UsePct)})
		}
	}

	// GPU checks
	if len(h.GPUs) == 0 && h.GPU == nil {
		message := fmt.Sprintf("%s GPU metrics unavailable; check NVIDIA driver/NVML", h.Name)
		if h.Error != "" {
			message = fmt.Sprintf("%s GPU metrics unavailable: %s", h.Name, h.Error)
		}
		h.Alerts = append(h.Alerts, Alert{Level: "warning", Message: message})
	}

	// GPU Temperature Warnings
	if len(h.GPUs) > 0 {
		for _, g := range h.GPUs {
			if g.TempC >= 86 {
				h.Alerts = append(h.Alerts, Alert{Level: "warning", Message: fmt.Sprintf("%s GPU %d temperature is %d C", h.Name, g.Index, g.TempC)})
			}
		}
	} else if h.GPU != nil && h.GPU.TempC >= 86 {
		h.Alerts = append(h.Alerts, Alert{Level: "warning", Message: fmt.Sprintf("%s GPU temperature is %d C", h.Name, h.GPU.TempC)})
	}

	if cpuPct >= 90 {
		h.Alerts = append(h.Alerts, Alert{Level: "warning", Message: fmt.Sprintf("%s CPU is %.0f%%", h.Name, cpuPct)})
	}
	if memPct >= 90 {
		h.Alerts = append(h.Alerts, Alert{Level: "warning", Message: fmt.Sprintf("%s system memory is %.0f%%", h.Name, memPct)})
	}
	if vramPct >= 90 {
		h.Alerts = append(h.Alerts, Alert{Level: "warning", Message: fmt.Sprintf("%s VRAM is %.0f%%", h.Name, vramPct)})
	}

	// Busy detection
	hasActiveGPU := false
	if len(h.GPUs) > 0 {
		for _, g := range h.GPUs {
			if g.UtilGPU >= 5 {
				hasActiveGPU = true
				break
			}
		}
	} else if h.GPU != nil && h.GPU.UtilGPU >= 5 {
		hasActiveGPU = true
	}

	if hasActiveGPU || vramPct >= 5 || cpuPct >= 50 {
		h.State = "busy"
		return
	}
	h.State = "idle"
}

func parseProbeOutput(status *HostStatus, out string) error {
	sections := map[string][]string{}
	active := ""
	scanner := bufio.NewScanner(strings.NewReader(out))
	scanner.Buffer(make([]byte, 0, 64*1024), 2*1024*1024)
	for scanner.Scan() {
		line := strings.TrimRight(scanner.Text(), "\r\n")
		if strings.HasPrefix(line, "__") && strings.HasSuffix(line, "__") {
			active = line
			continue
		}
		if active != "" && strings.TrimSpace(line) != "" {
			sections[active] = append(sections[active], line)
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	if lines := sections["__ERROR__"]; len(lines) > 0 {
		status.Error = strings.Join(lines, "; ")
	}
	parseGPU(status, sections["__GPU__"])
	parseMemory(status, sections["__MEM__"])
	parseDisk(status, sections["__DISK__"])
	parseUserDisk(status, sections["__USER_DISK__"])
	parseUserTmpDisk(status, sections["__USER_TMP_DISK__"])
	parseLogins(status, sections["__LOGINS__"])
	parseCPU(status, sections["__LOAD__"], sections["__CPU__"])
	parseProcesses(status, sections["__GPU_PROC__"], sections["__TOP__"])
	return nil
}

func parseGPU(s *HostStatus, lines []string) {
	if len(lines) == 0 {
		return
	}
	s.GPUs = []GPU{}
	for _, line := range lines {
		p := splitCSV(line)
		if len(p) < 7 {
			continue
		}
		gpu := GPU{Index: atoi(p[0]), Name: p[1], MemUsedMB: atoi(p[2]), MemTotalMB: atoi(p[3]), UtilGPU: atoi(p[4]), UtilMem: atoi(p[5]), TempC: atoi(p[6])}
		s.GPUs = append(s.GPUs, gpu)
	}
	if len(s.GPUs) > 0 {
		s.GPU = &s.GPUs[0]
	}
}

func parseMemory(s *HostStatus, lines []string) {
	if len(lines) == 0 {
		return
	}
	p := splitCSV(lines[0])
	if len(p) < 3 {
		return
	}
	s.Memory = &Memory{TotalMB: atoi(p[0]), UsedMB: atoi(p[1]), AvailableMB: atoi(p[2])}
}

func parseDisk(s *HostStatus, lines []string) {
	for _, line := range lines {
		p := splitCSV(line)
		if len(p) >= 6 {
			s.Disks = append(s.Disks, Disk{Source: p[0], Target: p[1], SizeMB: atoi(p[2]), UsedMB: atoi(p[3]), AvailableMB: atoi(p[4]), UsePct: atoi(p[5])})
		}
	}
}

func parseUserDisk(s *HostStatus, lines []string) {
	for _, line := range lines {
		p := splitCSV(line)
		if len(p) >= 2 {
			s.UserDisk = append(s.UserDisk, UserDisk{User: p[0], UsedMB: atoi(p[1])})
		}
	}
	sort.Slice(s.UserDisk, func(i, j int) bool { return s.UserDisk[i].UsedMB > s.UserDisk[j].UsedMB })
}

func parseUserTmpDisk(s *HostStatus, lines []string) {
	for _, line := range lines {
		p := splitCSV(line)
		if len(p) >= 2 {
			s.UserTmpDisk = append(s.UserTmpDisk, UserDisk{User: p[0], UsedMB: atoi(p[1])})
		}
	}
	sort.Slice(s.UserTmpDisk, func(i, j int) bool { return s.UserTmpDisk[i].UsedMB > s.UserTmpDisk[j].UsedMB })
}

func parseLogins(s *HostStatus, lines []string) {
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) >= 4 {
			user := fields[0]
			tty := fields[1]
			host := fields[2]
			timeStr := strings.Join(fields[3:], " ")
			s.Logins = append(s.Logins, LoginInfo{
				User: user,
				TTY:  tty,
				Host: host,
				Time: timeStr,
			})
		}
	}
}

func parseCPU(s *HostStatus, loadLines, cpuLines []string) {
	cpu := &CPU{}
	if len(loadLines) > 0 {
		p := splitCSV(loadLines[0])
		if len(p) >= 4 {
			cpu.Load1 = atof(p[0])
			cpu.Load5 = atof(p[1])
			cpu.Load15 = atof(p[2])
			cpu.CPUs = atoi(p[3])
		}
	}
	if len(cpuLines) > 0 {
		v := atof(cpuLines[0])
		cpu.UtilPct = &v
	}
	if cpu.CPUs != 0 || cpu.UtilPct != nil {
		s.CPU = cpu
	}
}

func parseProcesses(s *HostStatus, gpuLines, topLines []string) {
	gpu := map[string]ProcessInfo{}
	for _, line := range gpuLines {
		p := splitCSV(line)
		if len(p) >= 3 {
			gpu[p[0]] = ProcessInfo{PID: p[0], Process: p[1], GPUMemMB: atoi(p[2])}
		}
	}
	seen := map[string]bool{}
	for _, line := range topLines {
		fields := strings.Fields(line)
		if len(fields) < 7 {
			continue
		}
		head := fields[:6]
		cmd := strings.TrimSpace(strings.TrimPrefix(line, strings.Join(fields[:6], " ")))
		pi := ProcessInfo{PID: head[0], User: head[1], CPU: head[2], Mem: head[3], RSSKB: head[4], Comm: head[5], Cmd: cmd}
		if gp, ok := gpu[pi.PID]; ok {
			pi.Process = gp.Process
			pi.GPUMemMB = gp.GPUMemMB
		}
		s.Processes = append(s.Processes, pi)
		seen[pi.PID] = true
	}
	for pid, gp := range gpu {
		if !seen[pid] {
			s.Processes = append(s.Processes, gp)
		}
	}
}

func loadConfig(path string) (Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Config{}, err
	}
	data = []byte(strings.TrimPrefix(string(data), "\ufeff"))
	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return Config{}, err
	}
	if cfg.Dashboard.BindHost == "" {
		cfg.Dashboard.BindHost = "0.0.0.0"
	}
	if cfg.Dashboard.BindPort == 0 {
		cfg.Dashboard.BindPort = 18080
	}
	if cfg.Dashboard.PollSeconds == 0 {
		cfg.Dashboard.PollSeconds = 2
	}
	if cfg.Dashboard.AgentPort == 0 {
		cfg.Dashboard.AgentPort = 18180
	}
	return cfg, nil
}

func writeJSON(w http.ResponseWriter, v any) {
	body, _ := json.Marshal(v)
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(body)
}

func splitCSV(s string) []string {
	parts := strings.Split(s, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return parts
}
func atoi(s string) int {
	v, _ := strconv.Atoi(strings.TrimSpace(strings.TrimSuffix(s, "%")))
	return v
}
func atof(s string) float64 {
	v, _ := strconv.ParseFloat(strings.TrimSpace(strings.TrimSuffix(s, "%")), 64)
	return v
}
func getenv(k, f string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return f
}
func fallback(v, f string) string {
	if v != "" {
		return v
	}
	return f
}
func clamp(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

var _ = subtle.ConstantTimeCompare

type PortProxyMapping struct {
	ListenAddress  string `json:"listen_address"`
	ListenPort     int    `json:"listen_port"`
	ConnectAddress string `json:"connect_address"`
	ConnectPort    int    `json:"connect_port"`
}

func getPortProxies() ([]PortProxyMapping, error) {
	cmd := exec.Command("cmd", "/c", "chcp 65001 >nul && netsh interface portproxy show all")
	output, err := cmd.Output()
	if err != nil {
		cmd2 := exec.Command("netsh", "interface", "portproxy", "show", "all")
		output, err = cmd2.Output()
		if err != nil {
			return nil, err
		}
	}
	
	lines := strings.Split(string(output), "\n")
	var mappings []PortProxyMapping
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) != 4 {
			continue
		}
		lp, err1 := strconv.Atoi(fields[1])
		cp, err2 := strconv.Atoi(fields[3])
		if err1 == nil && err2 == nil {
			mappings = append(mappings, PortProxyMapping{
				ListenAddress:  fields[0],
				ListenPort:     lp,
				ConnectAddress: fields[2],
				ConnectPort:    cp,
			})
		}
	}
	return mappings, nil
}

func (a *app) handlePortProxy(w http.ResponseWriter, r *http.Request) {
	mappings, err := getPortProxies()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, mappings)
}

func (a *app) handlePortProxyAdd(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var m PortProxyMapping
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if m.ListenAddress == "" {
		m.ListenAddress = "0.0.0.0"
	}
	if m.ConnectPort == 0 {
		m.ConnectPort = 11433
	}
	
	cmd := exec.Command("netsh", "interface", "portproxy", "add", "v4tov4",
		"listenport="+strconv.Itoa(m.ListenPort),
		"listenaddress="+m.ListenAddress,
		"connectport="+strconv.Itoa(m.ConnectPort),
		"connectaddress="+m.ConnectAddress,
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		http.Error(w, fmt.Sprintf("%v: %s", err, string(output)), http.StatusInternalServerError)
		return
	}
	_, _ = w.Write([]byte("ok\n"))
}

func (a *app) handlePortProxyDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var m struct {
		ListenAddress string `json:"listen_address"`
		ListenPort    int    `json:"listen_port"`
	}
	if err := json.NewDecoder(r.Body).Decode(&m); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if m.ListenAddress == "" {
		m.ListenAddress = "0.0.0.0"
	}
	
	cmd := exec.Command("netsh", "interface", "portproxy", "delete", "v4tov4",
		"listenport="+strconv.Itoa(m.ListenPort),
		"listenaddress="+m.ListenAddress,
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		http.Error(w, fmt.Sprintf("%v: %s", err, string(output)), http.StatusInternalServerError)
		return
	}
	_, _ = w.Write([]byte("ok\n"))
}

func (a *app) handleUnslothStatus(w http.ResponseWriter, r *http.Request) {
	hostName := r.URL.Query().Get("host")
	hostIP, agentPort, err := a.getHostAddr(hostName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	token := a.getAgentToken()
	targetURL := fmt.Sprintf("http://%s:%d/unsloth/status", hostIP, agentPort)
	a.proxyRequest(w, r, http.MethodGet, targetURL, token)
}

func (a *app) handleUnslothControl(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	hostName := r.URL.Query().Get("host")
	action := r.URL.Query().Get("action")
	minutes := r.URL.Query().Get("minutes")
	
	hostIP, agentPort, err := a.getHostAddr(hostName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	token := a.getAgentToken()
	targetURL := fmt.Sprintf("http://%s:%d/unsloth/control?action=%s&minutes=%s", hostIP, agentPort, action, minutes)
	a.proxyRequest(w, r, http.MethodPost, targetURL, token)
}

func (a *app) getHostAddr(hostName string) (string, int, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	for _, h := range a.last.Hosts {
		if h.Name == hostName {
			return h.IP, h.Port, nil
		}
	}
	return "", 0, errors.New("host not found")
}

func (a *app) getAgentToken() string {
	cfg, err := loadConfig(a.configPath)
	token := ""
	if err == nil {
		token = cfg.Dashboard.AgentToken
		if v := os.Getenv("DASHBOARD_AGENT_TOKEN"); v != "" {
			token = v
		}
	}
	return token
}

func (a *app) proxyRequest(w http.ResponseWriter, r *http.Request, method, targetURL, token string) {
	req, err := http.NewRequest(method, targetURL, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if token != "" {
		req.Header.Set("X-Agent-Token", token)
	}
	resp, err := a.client.Do(req)
	if err != nil {
		http.Error(w, fmt.Sprintf("agent unreachable: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func (a *app) handleUnslothModels(w http.ResponseWriter, r *http.Request) {
	hostName := r.URL.Query().Get("host")
	hostIP, _, err := a.getHostAddr(hostName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	targetURL := fmt.Sprintf("http://%s:8888/api/models/local", hostIP)
	
	req, err := http.NewRequest(http.MethodGet, targetURL, nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	req.Header.Set("Authorization", "Bearer REDACTED_UNSLOTH_API_KEY")
	
	resp, err := a.client.Do(req)
	if err != nil {
		http.Error(w, fmt.Sprintf("unsloth unreachable: %v", err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	_, _ = io.Copy(w, resp.Body)
}

func (a *app) handleJumpHostStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	psCmd := `$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average; $os = Get-CimInstance Win32_OperatingSystem | Select-Object Caption, TotalVisibleMemorySize, FreePhysicalMemory, LastBootUpTime; $disks = Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object DeviceID, Size, FreeSpace; $processes = Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 25 | Select-Object Id, ProcessName, CPU, WorkingSet64; $users = if (Get-Command quser -ErrorAction SilentlyContinue) { quser 2>&1 | Out-String } else { (Get-CimInstance Win32_ComputerSystem).UserName }; $result = @{ cpu_util_pct = [int]$cpu; mem_total_kb = $os.TotalVisibleMemorySize; mem_free_kb = $os.FreePhysicalMemory; os_name = $os.Caption; last_boot_time = $os.LastBootUpTime.ToString('yyyy-MM-dd HH:mm:ss'); disks = $disks; processes = $processes; users = $users }; $result | ConvertTo-Json -Compress`
	
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	
	cmd := exec.CommandContext(ctx, "powershell", "-NoProfile", "-Command", psCmd)
	output, err := cmd.CombinedOutput()
	if err != nil {
		http.Error(w, fmt.Sprintf("powershell error: %v, output: %s", err, string(output)), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(output)
}

func (a *app) handlePalworldSettings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	filePath := `C:\Users\James\tools\palserver\Pal\Saved\Config\WindowsServer\PalWorldSettings.ini`
	data, err := os.ReadFile(filePath)
	if err != nil {
		// Fallback to default
		filePath = `C:\Users\James\tools\palserver\DefaultPalWorldSettings.ini`
		data, err = os.ReadFile(filePath)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	content := string(data)
	start := strings.Index(content, "OptionSettings=(")
	if start == -1 {
		http.Error(w, "invalid config format: OptionSettings not found", http.StatusInternalServerError)
		return
	}
	start += len("OptionSettings=(")
	end := strings.LastIndex(content, ")")
	if end == -1 || end < start {
		http.Error(w, "invalid config format: matching parenthesis not found", http.StatusInternalServerError)
		return
	}
	optionsStr := content[start:end]
	settings := parsePalworldOptions(optionsStr)
	writeJSON(w, settings)
}

func parsePalworldOptions(s string) map[string]string {
	m := make(map[string]string)
	var key, val strings.Builder
	inQuotes := false
	inParens := 0
	isKey := true
	
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if ch == '"' {
			inQuotes = !inQuotes
			val.WriteByte(ch)
		} else if ch == '(' && !inQuotes {
			inParens++
			val.WriteByte(ch)
		} else if ch == ')' && !inQuotes {
			inParens--
			val.WriteByte(ch)
		} else if ch == '=' && !inQuotes && inParens == 0 && isKey {
			isKey = false
		} else if ch == ',' && !inQuotes && inParens == 0 {
			k := strings.TrimSpace(key.String())
			v := strings.TrimSpace(val.String())
			if k != "" {
				m[k] = v
			}
			key.Reset()
			val.Reset()
			isKey = true
		} else {
			if isKey {
				key.WriteByte(ch)
			} else {
				val.WriteByte(ch)
			}
		}
	}
	k := strings.TrimSpace(key.String())
	v := strings.TrimSpace(val.String())
	if k != "" {
		m[k] = v
	}
	return m
}

func (a *app) handlePalworldSettingsSave(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var newSettings map[string]string
	if err := json.NewDecoder(r.Body).Decode(&newSettings); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	filePath := `C:\Users\James\tools\palserver\Pal\Saved\Config\WindowsServer\PalWorldSettings.ini`
	data, err := os.ReadFile(filePath)
	var originalKeys []string
	if err == nil {
		content := string(data)
		start := strings.Index(content, "OptionSettings=(")
		if start != -1 {
			start += len("OptionSettings=(")
			end := strings.LastIndex(content, ")")
			if end != -1 && end > start {
				origMap := parsePalworldOptions(content[start:end])
				for k := range origMap {
					originalKeys = append(originalKeys, k)
				}
				sort.Strings(originalKeys)
			}
		}
	}
	
	if len(originalKeys) == 0 {
		for k := range newSettings {
			originalKeys = append(originalKeys, k)
		}
		sort.Strings(originalKeys)
	}
	
	var parts []string
	for _, k := range originalKeys {
		if v, ok := newSettings[k]; ok {
			parts = append(parts, fmt.Sprintf("%s=%s", k, v))
		}
	}
	
	output := fmt.Sprintf("[/Script/Pal.PalGameWorldSettings]\nOptionSettings=(%s)\n", strings.Join(parts, ","))
	
	err = os.WriteFile(filePath, []byte(output), 0644)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_, _ = w.Write([]byte("ok\n"))
}

func (a *app) handlePalworldControl(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	action := r.URL.Query().Get("action")
	if action == "restart" {
		// Stop PalServer
		_ = exec.Command("taskkill", "/F", "/IM", "PalServer-Win64-Shipping-Cmd.exe").Run()
		_ = exec.Command("taskkill", "/F", "/IM", "PalServer.exe").Run()
		
		time.Sleep(2 * time.Second)
		
		// Start PalServer
		cmd := exec.Command("C:\\Users\\James\\tools\\palserver\\PalServer.exe")
		cmd.Dir = "C:\\Users\\James\\tools\\palserver"
		err := cmd.Start()
		if err != nil {
			http.Error(w, fmt.Sprintf("start error: %v", err), http.StatusInternalServerError)
			return
		}
		_, _ = w.Write([]byte("restarted\n"))
		return
	}
	http.Error(w, "invalid action", http.StatusBadRequest)
}
