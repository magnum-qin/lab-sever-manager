package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"time"
)

func main() {
	probe := getenv("DASHBOARD_PROBE", "/home/g24tka12/lab-server-manager/dashboard_probe.sh")
	port := getenv("AGENT_PORT", "18180")
	if _, err := strconv.Atoi(port); err != nil {
		log.Fatalf("invalid AGENT_PORT %q: %v", port, err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", statusHandler(probe))
	mux.HandleFunc("/status", statusHandler(probe))

	addr := "127.0.0.1:" + port
	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 3 * time.Second,
	}
	log.Printf("gpu-status-agent listening on http://%s/status, probe=%s", addr, probe)
	log.Fatal(server.ListenAndServe())
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func statusHandler(probe string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" && r.URL.Path != "/status" {
			http.NotFound(w, r)
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
