#!/usr/bin/env python3
"""Run this, hover mouse over the Home tab in Claude Desktop, press Enter."""
import subprocess

input("Наведи мышь на Home таб в Claude Desktop и нажми Enter...")

result = subprocess.run(
    ["osascript", "-e", "tell application \"System Events\" to return (get position of (item 1 of (every process whose name is \"Claude\")))"],
    capture_output=True, text=True
)

mouse_result = subprocess.run(
    ["osascript", "-e", """
tell application "System Events"
    set pos to position of (item 1 of (every process whose frontmost is true))
end tell
return pos
"""],
    capture_output=True, text=True
)

# Get actual mouse position via Quartz
script = """
import Quartz
loc = Quartz.NSEvent.mouseLocation()
print(f"Mouse: x={loc.x:.0f}, y={loc.y:.0f}")

# Get Claude window position
import subprocess, re
r = subprocess.run(['osascript', '-e', 'tell application \"System Events\" to tell process \"Claude\" to get position of window 1'], capture_output=True, text=True)
print(f"Window pos: {r.stdout.strip()}")
r2 = subprocess.run(['osascript', '-e', 'tell application \"System Events\" to tell process \"Claude\" to get size of window 1'], capture_output=True, text=True)
print(f"Window size: {r2.stdout.strip()}")
"""
subprocess.run(["python3", "-c", script])
