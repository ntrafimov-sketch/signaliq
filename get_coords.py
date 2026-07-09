#!/usr/bin/env python3
import subprocess

input("Наведи мышь на Home таб в Claude Desktop и нажми Enter...")

r = subprocess.run(["osascript", "-l", "JavaScript", "-e", """
ObjC.import('AppKit');
var loc = $.NSEvent.mouseLocation;
var screen = $.NSScreen.mainScreen.frame;
var screenH = screen.size.height;
// Convert AppKit (bottom-left origin) to AppleScript (top-left origin)
var asY = screenH - loc.y;
var asX = loc.x;

var app = Application('System Events');
var claude = app.processes.whose({name: 'Claude'})[0];
var win = claude.windows[0];
var pos = win.position();
var sz = win.size();

var offsetX = Math.round(asX - pos[0]);
var offsetY = Math.round(asY - pos[1]);

'Mouse AS coords: ' + Math.round(asX) + ',' + Math.round(asY) +
'\\nWindow pos: ' + pos[0] + ',' + pos[1] + ' size: ' + sz[0] + 'x' + sz[1] +
'\\nOffset from window top-left: x+' + offsetX + ', y+' + offsetY;
"""], capture_output=True, text=True)

print(r.stdout.strip() or r.stderr.strip())
