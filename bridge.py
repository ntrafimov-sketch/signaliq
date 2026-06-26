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

PORT = 7337

# Claude Desktop app name on Mac — change if needed
# Run `osascript -e 'tell application "System Events" to get name of every application process'`
# to see all running app names
CLAUDE_APP = "Claude"


def paste_prompt_to_claude(prompt: str) -> None:
    """Low-level: paste a prompt string into a new Claude Desktop chat."""
    prompt_escaped = prompt.replace("\\", "\\\\").replace('"', '\\"')
    script = f"""
set prevApp to (path to frontmost application as text)

tell application "{CLAUDE_APP}"
    activate
end tell

delay 0.5

tell application "System Events"
    tell process "{CLAUDE_APP}"
        try
            click button "Chat" of window 1
            delay 0.3
        end try
        keystroke "n" using command down
        delay 0.6
        set the clipboard to "{prompt_escaped}"
        keystroke "v" using command down
        delay 0.3
        key code 36
    end tell
end tell

delay 0.3

try
    tell application (prevApp) to activate
end try
"""
    subprocess.run(["osascript", "-e", script], check=True)


def trigger_sequence(data: dict) -> None:
    """Build a sequence generation prompt and paste it into Claude Desktop."""
    person = data.get("person", {})
    account = data.get("account", {})
    signals = data.get("signals", [])

    top_signals = "\n".join(
        f"- [{s.get('category','')}] {s.get('title','')}: {s.get('description','')}"
        for s in signals[:8]
    )

    wtp = person.get("whatToPitch") or person.get("what_to_pitch") or {}

    system_note = (
        "You are an expert B2B sales copywriter for Adapty — a mobile subscription infrastructure platform.\n"
        "ADAPTY PRODUCT: Paywall builder with A/B testing, subscription analytics, RevenueCat/Superwall competitor.\n"
        "TONE: Direct, outcome-focused. Max 120 words per email. Subject lines under 8 words.\n"
        "OUTPUT FORMAT: Return ONLY valid JSON array:\n"
        '[{"type":"Email","style":"Cold · Outcome-led","subject":"...","body":"...","basedOn":[...]},\n'
        ' {"type":"Email","style":"Follow-up 1","subject":"...","body":"...","basedOn":[...]},\n'
        ' {"type":"LinkedIn","style":"LinkedIn · Connection","body":"...","basedOn":[...]},\n'
        ' {"type":"Follow-up","style":"Follow-up 2 · Breakup","subject":"...","body":"...","basedOn":[]}]'
    )

    prompt = f"""{system_note}

---

Generate a 4-message outreach sequence for this prospect.

CONTACT:
- Name: {person.get('name','')}
- Title: {person.get('title','')}
- Department: {person.get('department','')}
- Company: {account.get('company_name','')} ({account.get('domain','')})
- Industry: {account.get('industry','')}
- Employees: {account.get('employees','')}
- Influence: {person.get('influence','')}
{f"- Bio: {person.get('bio','')}" if person.get('bio') else ""}
{f"- Recommended angle: {wtp.get('recommendedAngle') or wtp.get('recommended_angle','')}" if wtp.get('recommendedAngle') or wtp.get('recommended_angle') else ""}
{f"- Likely priorities: {wtp.get('likelyPriorities') or wtp.get('likely_priorities','')}" if wtp.get('likelyPriorities') or wtp.get('likely_priorities') else ""}
{f"- Pain points: {wtp.get('painPoints') or wtp.get('pain_points','')}" if wtp.get('painPoints') or wtp.get('pain_points') else ""}

ACCOUNT SIGNALS:
{top_signals}

WHY THIS ACCOUNT MATTERS:
{account.get('whyMatters') or account.get('why_matters') or 'Mobile app company that could benefit from Adapty'}

OPPORTUNITY:
{(account.get('opportunitySummary') or account.get('opportunity_summary') or {}).get('recommendedAngle','Subscription optimization and paywall A/B testing')}

Write 4 messages: cold email, follow-up 1, LinkedIn connection request, breakup email.
Reference {person.get('name','the person')}'s specific role and the signals above.
Sign as [Your name] from Adapty."""

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
    prompt_escaped = prompt.replace("\\", "\\\\").replace('"', '\\"')

    # Save image to temp file if provided
    img_path = None
    if data.get("image_b64"):
        img_data = base64.b64decode(data["image_b64"])
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.write(img_data)
        tmp.close()
        img_path = tmp.name

    # Build AppleScript — paste text prompt, then paste image if provided
    img_block = ""
    if img_path:
        safe_path = img_path.replace("\\", "\\\\").replace('"', '\\"')
        img_block = f"""
        -- Paste image into the same message
        delay 0.2
        set the clipboard to (read (POSIX file "{safe_path}") as «class PNGf»)
        keystroke "v" using command down
        delay 0.3"""

    script = f"""
set prevApp to (path to frontmost application as text)

tell application "{CLAUDE_APP}"
    activate
end tell

delay 0.5

tell application "System Events"
    tell process "{CLAUDE_APP}"
        try
            click button "Chat" of window 1
            delay 0.3
        end try
        keystroke "n" using command down
        delay 0.6
        set the clipboard to "{prompt_escaped}"
        keystroke "v" using command down{img_block}
        delay 0.3
        key code 36
    end tell
end tell

delay 0.3

try
    tell application (prevApp) to activate
end try
"""
    try:
        subprocess.run(["osascript", "-e", script], check=True)
    finally:
        if img_path and os.path.exists(img_path):
            os.unlink(img_path)


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

    server = HTTPServer(("localhost", PORT), Handler)
    print(f"  SignalIQ Bridge running on http://localhost:{PORT}")
    print("  Ready — researching will happen in background!\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Bridge stopped.")
        sys.exit(0)
