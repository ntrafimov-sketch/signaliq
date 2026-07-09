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
import base64
import os
import tempfile
import threading
import urllib.request

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
SKILL_PATH = os.path.join(os.path.dirname(__file__), ".claude", "skills", "cold-email-master.md")

PORT = 7337

# Claude Desktop app name on Mac — change if needed
# Run `osascript -e 'tell application "System Events" to get name of every application process'`
# to see all running app names
CLAUDE_APP = "Claude"


def dump_ui_tree() -> str:
    """Dump top-level UI groups of Claude Desktop window for diagnostics."""
    script = f"""
tell application "System Events"
    tell process "{CLAUDE_APP}"
        set w to window 1
        set out to ""
        set grps to groups of w
        repeat with i from 1 to count of grps
            set g to item i of grps
            set out to out & "G" & i & ": role=" & role of g & " desc=" & description of g & " title=" & title of g & "\\n"
            try
                set subs to groups of g
                repeat with j from 1 to count of subs
                    set sg to item j of subs
                    set out to out & "  G" & i & "." & j & ": role=" & role of sg & " desc=" & description of sg & "\\n"
                    try
                        set subs2 to groups of sg
                        repeat with k from 1 to count of subs2
                            set sg2 to item k of subs2
                            set out to out & "    G" & i & "." & j & "." & k & ": desc=" & description of sg2 & " title=" & title of sg2 & "\\n"
                        end repeat
                    end try
                end repeat
            end try
        end repeat
        return out
    end tell
end tell
"""
    r = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=10)
    return r.stdout.strip() or r.stderr.strip()


def open_new_home_chat() -> None:
    """Open a new Home chat in Claude Desktop."""
    import time as _time
    subprocess.run(["osascript", "-e",
        f'tell application "System Events" to tell process "{CLAUDE_APP}" to keystroke "n" using command down'],
        capture_output=True)
    _time.sleep(1.2)


def paste_prompt_to_claude(prompt: str) -> None:
    """Low-level: paste a prompt string into a new Claude Desktop chat."""
    tmp = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8')
    tmp.write(prompt)
    tmp.close()
    tmp_path = tmp.name

    safe_tmp = tmp_path.replace("\\", "\\\\").replace('"', '\\"')

    # Activate Claude, then open new Home chat via File menu
    subprocess.run(["osascript", "-e", f'tell application "{CLAUDE_APP}" to activate'])
    import time as _time
    _time.sleep(0.5)
    open_new_home_chat()

    script = f"""
tell application "System Events"
    tell process "{CLAUDE_APP}"
        do shell script "cat " & quoted form of "{safe_tmp}" & " | pbcopy"
        delay 0.3
        keystroke "v" using command down
        delay 0.3
        key code 36
    end tell
end tell
do shell script "rm -f " & quoted form of "{safe_tmp}"
"""
    try:
        subprocess.run(["osascript", "-e", script], check=True)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


CLAY_SEQUENCE_WEBHOOK = "https://api.clay.com/v3/sources/webhook/pull-in-data-from-a-webhook-5b3b2188-ad8b-4392-829d-5248bff64596"

def trigger_sequence(data: dict) -> None:
    """Paste /cold-email-master prompt into Claude Desktop via AppleScript."""
    person = data.get("person", {})
    account = data.get("account", {})
    name = person.get("name", "").strip()
    account_id = account.get("id", data.get("account_id", ""))
    person_id = person.get("id", data.get("person_id", ""))
    torpedo_json = json.dumps(account.get("torpedoData") or data.get("torpedo_json") or [], ensure_ascii=False)

    prompt = f"""/cold-email-master {name}

<torpedo_json>
{torpedo_json}
</torpedo_json>

After generating the sequence JSON, send it to SignalIQ by running this curl command (replace SEQUENCE_JSON_HERE with the full JSON object, no quotes around it):

curl -s -X POST "{CLAY_SEQUENCE_WEBHOOK}" -H "Content-Type: application/json" -d '{{"account_id":"{account_id}","person_id":"{person_id}","result":SEQUENCE_JSON_HERE}}'"""

    paste_prompt_to_claude(prompt)


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

    # Save image to temp file if provided
    img_path = None
    if data.get("image_b64"):
        img_data = base64.b64decode(data["image_b64"])
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.write(img_data)
        tmp.close()
        img_path = tmp.name

    # Write prompt to temp file for clipboard (avoids AppleScript escaping issues)
    tmp_prompt = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8')
    tmp_prompt.write(prompt)
    tmp_prompt.close()
    tmp_prompt_path = tmp_prompt.name

    # Build AppleScript — pbcopy inside AppleScript right before paste
    img_block = ""
    if img_path:
        safe_path = img_path.replace("\\", "\\\\").replace('"', '\\"')
        img_block = f"""
        -- Paste image into the same message
        delay 0.2
        set the clipboard to (read (POSIX file "{safe_path}") as «class PNGf»)
        keystroke "v" using command down
        delay 0.3"""

    safe_tmp = tmp_prompt_path.replace("\\", "\\\\").replace('"', '\\"')

    subprocess.run(["osascript", "-e", f'tell application "{CLAUDE_APP}" to activate'])
    import time as _time
    _time.sleep(0.5)
    open_new_home_chat()

    script = f"""
tell application "System Events"
    tell process "{CLAUDE_APP}"
        do shell script "cat " & quoted form of "{safe_tmp}" & " | pbcopy"
        delay 0.3
        keystroke "v" using command down{img_block}
        delay 0.3
        key code 36
    end tell
end tell

do shell script "rm -f " & quoted form of "{safe_tmp}"
"""
    try:
        subprocess.run(["osascript", "-e", script], check=True)
    finally:
        if img_path and os.path.exists(img_path):
            os.unlink(img_path)
        if os.path.exists(tmp_prompt_path):
            os.unlink(tmp_prompt_path)


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
        elif self.path == "/debug":
            tree = dump_ui_tree()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(tree.encode())
            print(f"  UI tree:\n{tree}")
        else:
            self.send_response(404)
            self.end_headers()

    def _handle(self, fn, label):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            fn(body)
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            print(f"  ✓ {label}")
        except Exception as e:
            self.send_response(500)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode())
            print(f"  ✗ Error: {e}")

    def do_POST(self):
        if self.path == "/trigger":
            self._handle(trigger_claude, f"Research launched")
        elif self.path == "/sequence":
            def run(body):
                trigger_sequence(body)
                name = (body.get("person") or {}).get("name", "?")
                company = (body.get("account") or {}).get("company_name", "?")
                print(f"  ✓ Sequence prompt sent for {name} @ {company}")
            self._handle(run, "Sequence prompt launched in Claude")
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

    # Print Claude Desktop File menu items for diagnostics
    try:
        r = subprocess.run(
            ["osascript", "-e",
             f'tell application "System Events" to tell process "{CLAUDE_APP}" to get name of every menu item of menu "File" of menu bar 1'],
            capture_output=True, text=True, timeout=5
        )
        if r.stdout.strip():
            print(f"  Claude File menu items: {r.stdout.strip()}")
        r2 = subprocess.run(
            ["osascript", "-e",
             f'tell application "System Events" to tell process "{CLAUDE_APP}" to get name of every menu item of menu "Window" of menu bar 1'],
            capture_output=True, text=True, timeout=5
        )
        if r2.stdout.strip():
            print(f"  Claude Window menu items: {r2.stdout.strip()}")
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
