#!/usr/bin/env python3
# Run with: python3 bridge.py
"""
SignalIQ Bridge — triggers Claude Desktop from the dashboard form.
Run once: python3 bridge.py
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import subprocess
import sys

PORT = 7337

# Claude Desktop app name on Mac — change if needed
# Run `osascript -e 'tell application "System Events" to get name of every application process'`
# to see all running app names
CLAUDE_APP = "Claude"


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
    prompt_escaped = prompt.replace("\\", "\\\\").replace('"', '\\"')

    script = f"""
-- Remember which app is currently in front
set prevApp to (path to frontmost application as text)

-- Find Claude Desktop window (not Claude Code)
-- We target by bundle ID to avoid hitting Claude Code CLI wrapper
tell application "{CLAUDE_APP}"
    -- Open a new chat without stealing focus permanently
    activate
end tell

delay 0.5

tell application "System Events"
    tell process "{CLAUDE_APP}"
        -- Cmd+N opens new conversation
        keystroke "n" using command down
        delay 0.5
        -- Paste the prompt
        set the clipboard to "{prompt_escaped}"
        keystroke "v" using command down
        delay 0.3
        -- Send
        key code 36
    end tell
end tell

delay 0.3

-- Switch back to the app that was in front before
try
    tell application (prevApp) to activate
end try
"""
    subprocess.run(["osascript", "-e", script], check=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

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
                print(f"  ✓ Launched research for: {body.get('company', '?')}")
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
    # Detect which Claude app is running
    try:
        result = subprocess.run(
            ["osascript", "-e",
             'tell application "System Events" to get name of every application process'],
            capture_output=True, text=True
        )
        procs = result.stdout
        if "Claude Code" in procs and "Claude" in procs:
            print("  ⚠️  Both 'Claude' and 'Claude Code' detected.")
            print(f"  → Targeting: '{CLAUDE_APP}'")
            print("  → If wrong, edit CLAUDE_APP at top of bridge.py\n")
    except Exception:
        pass

    server = HTTPServer(("localhost", PORT), Handler)
    print(f"  SignalIQ Bridge running on http://localhost:{PORT}")
    print("  Ready — researching will happen in background!\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Bridge stopped.")
        sys.exit(0)
