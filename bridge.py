#!/usr/bin/env python3
# Run with: python3 bridge.py
"""
SignalIQ Bridge — triggers Claude Desktop from the dashboard form.
Run once: python bridge.py
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import subprocess
import sys

PORT = 7337


def trigger_claude(data: dict) -> None:
    parts = []
    if data.get("company"):
        parts.append(f"Company: {data['company']}")
    if data.get("domain"):
        parts.append(f"Domain: {data['domain']}")
    if data.get("app_name"):
        parts.append(f"App: {data['app_name']}")
    if data.get("linkedin"):
        parts.append(f"LinkedIn: {data['linkedin']}")

    prompt = "/torpedo-research-agent " + ", ".join(parts)

    # Escape for AppleScript string
    prompt_escaped = prompt.replace("\\", "\\\\").replace('"', '\\"')

    script = f"""
tell application "Claude" to activate
delay 0.6
tell application "System Events"
    keystroke "n" using command down
    delay 0.6
    set the clipboard to "{prompt_escaped}"
    keystroke "v" using command down
    delay 0.2
    key code 36
end tell
"""
    subprocess.run(["osascript", "-e", script], check=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # suppress default access logs

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/trigger":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length))
                trigger_claude(body)
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"ok":true}')
                company = body.get("company", "unknown")
                print(f"  ✓ Launched research for: {company}")
            except Exception as e:
                self.send_response(500)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())
                print(f"  ✗ Error: {e}")
        else:
            self.send_response(404)
            self.end_headers()


if __name__ == "__main__":
    server = HTTPServer(("localhost", PORT), Handler)
    print(f"\n  SignalIQ Bridge running on http://localhost:{PORT}")
    print("  Open Claude Desktop and start researching from the dashboard!\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Bridge stopped.")
        sys.exit(0)
