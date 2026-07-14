package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	idleCounter int
	idleMu      sync.Mutex
)

type UnslothStatus struct {
	Installed      bool   `json:"installed"`
	Running        bool   `json:"running"`
	VRAMUsedMB     int    `json:"vram_used_mb"`
	TimeoutMinutes int    `json:"timeout_minutes"`
	ActiveModel    string `json:"active_model"`
}

func main() {
	probe := getenv("DASHBOARD_PROBE", "/home/g24tka12/lab-server-manager/dashboard_probe.sh")
	bind := getenv("AGENT_BIND", "127.0.0.1")
	port := getenv("AGENT_PORT", "18180")
	token := os.Getenv("AGENT_TOKEN")
	if _, err := strconv.Atoi(port); err != nil {
		log.Fatalf("invalid AGENT_PORT %q: %v", port, err)
	}

	go autoUnloadDaemon()

	mux := http.NewServeMux()
	mux.HandleFunc("/", statusHandler(probe, token))
	mux.HandleFunc("/status", statusHandler(probe, token))
	mux.HandleFunc("/unsloth/status", unslothStatusHandler(token))
	mux.HandleFunc("/unsloth/control", unslothControlHandler(token))

	addr := bind + ":" + port
	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 3 * time.Second,
	}
	log.Printf("gpu-status-agent (unsloth edition) listening on http://%s, token_required=%t", addr, token != "")
	log.Fatal(server.ListenAndServe())
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func statusHandler(probe, token string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && r.URL.Path != "/status" {
			http.NotFound(w, r)
			return
		}
		if token != "" && subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Agent-Token")), []byte(token)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
		defer cancel()

		cmd := exec.CommandContext(ctx, "bash", probe)
		output, err := cmd.CombinedOutput()
		body := output
		if ctx.Err() == context.DeadlineExceeded {
			body = []byte("__ERROR__\nprobe timed out\n")
		} else if err != nil {
			body = append([]byte(fmt.Sprintf("__ERROR__\n%v\n", err)), output...)
		}

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(body)
	}
}

func getTimeoutMinutes() int {
	home, err := os.UserHomeDir()
	if err != nil {
		return 0
	}
	data, err := ioutil.ReadFile(filepath.Join(home, ".unsloth_auto_unload.json"))
	if err != nil {
		return 0
	}
	var config map[string]int
	if err := json.Unmarshal(data, &config); err != nil {
		return 0
	}
	return config["timeout_minutes"]
}

func setTimeoutMinutes(minutes int) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	config := map[string]int{"timeout_minutes": minutes}
	data, _ := json.Marshal(config)
	return ioutil.WriteFile(filepath.Join(home, ".unsloth_auto_unload.json"), data, 0644)
}

func unslothStatusHandler(token string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if token != "" && subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Agent-Token")), []byte(token)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		home, _ := os.UserHomeDir()
		installed := false
		if _, err := os.Stat(filepath.Join(home, ".unsloth", "studio", "unsloth_studio", "bin", "unsloth")); err == nil {
			installed = true
		}

		running := false
		cmd := exec.Command("systemctl", "--user", "is-active", "unsloth-studio.service")
		if err := cmd.Run(); err == nil {
			running = true
		}

		vramUsed := 0
		activeModel := ""
		if running {
			pids := getUnslothPIDs()
			vramUsed = getUnslothVramUsed(pids)
			activeModel = getActiveModel()
		}

		status := UnslothStatus{
			Installed:      installed,
			Running:        running,
			VRAMUsedMB:     vramUsed,
			TimeoutMinutes: getTimeoutMinutes(),
			ActiveModel:    activeModel,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(status)
	}
}

func unslothControlHandler(token string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if token != "" && subtle.ConstantTimeCompare([]byte(r.Header.Get("X-Agent-Token")), []byte(token)) != 1 {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		action := r.URL.Query().Get("action")
		switch action {
		case "start":
			_ = exec.Command("systemctl", "--user", "start", "unsloth-studio.service").Run()
			w.Write([]byte("started\n"))
		case "stop":
			_ = exec.Command("systemctl", "--user", "stop", "unsloth-studio.service").Run()
			w.Write([]byte("stopped\n"))
		case "unload":
			// Unload by restarting the service to forcibly clear VRAM
			_ = exec.Command("systemctl", "--user", "restart", "unsloth-studio.service").Run()
			idleMu.Lock()
			idleCounter = 0
			idleMu.Unlock()
			w.Write([]byte("unloaded via restart\n"))
		case "set_timeout":
			minutes, _ := strconv.Atoi(r.URL.Query().Get("minutes"))
			_ = setTimeoutMinutes(minutes)
			idleMu.Lock()
			idleCounter = 0
			idleMu.Unlock()
			w.Write([]byte("timeout updated\n"))
		default:
			http.Error(w, "invalid action", http.StatusBadRequest)
		}
	}
}

func autoUnloadDaemon() {
	ticker := time.NewTicker(1 * time.Minute)
	for range ticker.C {
		timeout := getTimeoutMinutes()
		if timeout <= 0 {
			continue
		}

		// Check if unsloth is running
		if err := exec.Command("systemctl", "--user", "is-active", "unsloth-studio.service").Run(); err != nil {
			idleMu.Lock()
			idleCounter = 0
			idleMu.Unlock()
			continue
		}

		// Get VRAM and Util
		out, err := exec.Command("nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits").Output()
		if err != nil {
			continue
		}

		vramUsed := getUnslothVramUsed(getUnslothPIDs())
		maxUtil := 0
		lines := strings.Split(strings.TrimSpace(string(out)), "\n")
		for _, line := range lines {
			if u, err := strconv.Atoi(strings.TrimSpace(line)); err == nil {
				if u > maxUtil {
					maxUtil = u
				}
			}
		}

		idleMu.Lock()
		if vramUsed > 2000 { // Model is loaded
			if maxUtil < 5 { // Idle
				idleCounter++
				log.Printf("Unsloth idle for %d minutes (timeout: %d)", idleCounter, timeout)
				if idleCounter >= timeout {
					log.Printf("Auto-unloading Unsloth models due to %d minutes of inactivity...", idleCounter)
					_ = exec.Command("systemctl", "--user", "restart", "unsloth-studio.service").Run()
					idleCounter = 0
				}
			} else { // Active
				idleCounter = 0
			}
		} else { // No model loaded
			idleCounter = 0
		}
		idleMu.Unlock()
	}
}

func getUnslothPIDs() []int {
	pids := []int{}
	
	// 1. Get MainPID
	cmd := exec.Command("systemctl", "--user", "show", "unsloth-studio.service", "-p", "MainPID", "--value")
	out, err := cmd.Output()
	if err == nil {
		mainPidStr := strings.TrimSpace(string(out))
		if mainPid, err := strconv.Atoi(mainPidStr); err == nil && mainPid > 0 {
			pids = append(pids, mainPid)
		}
	}
	
	// 2. Try get all PIDs from cgroup
	cgCmd := exec.Command("systemctl", "--user", "show", "unsloth-studio.service", "-p", "ControlGroup", "--value")
	cgOut, err := cgCmd.Output()
	if err == nil {
		cgPath := strings.TrimSpace(string(cgOut))
		if cgPath != "" {
			paths := []string{
				filepath.Join("/sys/fs/cgroup", cgPath, "cgroup.procs"),
				filepath.Join("/sys/fs/cgroup/systemd", cgPath, "cgroup.procs"),
			}
			for _, p := range paths {
				data, err := os.ReadFile(p)
				if err == nil {
					lines := strings.Split(string(data), "\n")
					for _, line := range lines {
						if pid, err := strconv.Atoi(strings.TrimSpace(line)); err == nil && pid > 0 {
							exists := false
							for _, existing := range pids {
								if existing == pid {
									exists = true
									break
								}
							}
							if !exists {
								pids = append(pids, pid)
							}
						}
					}
					break
				}
			}
		}
	}
	
	return pids
}

func getUnslothVramUsed(pids []int) int {
	if len(pids) == 0 {
		return 0
	}
	
	totalUsed := 0
	out, err := exec.Command("nvidia-smi", "--query-compute-apps=pid,used_memory", "--format=csv,noheader,nounits").Output()
	if err == nil {
		lines := strings.Split(strings.TrimSpace(string(out)), "\n")
		for _, line := range lines {
			parts := strings.Split(line, ",")
			if len(parts) == 2 {
				pidStr := strings.TrimSpace(parts[0])
				memStr := strings.TrimSpace(parts[1])
				
				pid, err1 := strconv.Atoi(pidStr)
				mem, err2 := strconv.Atoi(memStr)
				
				if err1 == nil && err2 == nil {
					for _, targetPid := range pids {
						if targetPid == pid {
							totalUsed += mem
							break
						}
					}
				}
			}
		}
	}
	return totalUsed
}

func getActiveModel() string {
	client := &http.Client{Timeout: 2 * time.Second}
	req, err := http.NewRequest("GET", "http://127.0.0.1:8888/v1/models", nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Authorization", "Bearer REDACTED_UNSLOTH_API_KEY")
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}
	
	type ModelItem struct {
		ID string `json:"id"`
	}
	type ModelList struct {
		Data []ModelItem `json:"data"`
	}
	var list ModelList
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return ""
	}
	if len(list.Data) > 0 {
		return list.Data[0].ID
	}
	return ""
}
