#!/usr/bin/env python3
import subprocess

input("Наведи мышь на Home таб в Claude Desktop и нажми Enter...")

# Get mouse position via JXA (JavaScript for Automation — no extra modules needed)
mouse = subprocess.run(
    ["osascript", "-l", "JavaScript", "-e",
     "ObjC.import('AppKit'); var loc = $.NSEvent.mouseLocation; loc.x + ',' + loc.y"],
    capture_output=True, text=True
)

# Get Claude window position and size
win = subprocess.run(
    ["osascript", "-e",
     'tell application "System Events" to tell process "Claude" to return (position of window 1) & (size of window 1)'],
    capture_output=True, text=True
)

print("Mouse (screen coords):", mouse.stdout.strip() or mouse.stderr.strip())
print("Window pos+size:", win.stdout.strip() or win.stderr.strip())
