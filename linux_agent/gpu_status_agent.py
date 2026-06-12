#!/usr/bin/env python3
import os
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PROBE = os.environ.get("DASHBOARD_PROBE", "/home/g24tka12/lab-server-manager/dashboard_probe.sh")
PORT = int(os.environ.get("AGENT_PORT", "18180"))

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ("/", "/status"):
            self.send_error(404)
            return
        try:
            result = subprocess.run(
                ["timeout", "12s", "bash", PROBE],
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                timeout=15,
            )
            body = result.stdout
        except Exception as exc:
            body = "__ERROR__\n" + str(exc) + "\n"
        data = body.encode("utf-8", errors="replace")
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        return

if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
