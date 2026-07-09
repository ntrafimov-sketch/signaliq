#!/usr/bin/env python3
import subprocess

input("Наведи мышь на Home таб в Claude Desktop и нажми Enter...")

r = subprocess.run(["osascript", "-e", """
tell application "System Events"
    tell process "Claude"
        set winPos to position of window 1
        set winSize to size of window 1
    end tell
end tell
set mouseX to do shell script "python3 -c \\"import Quartz; loc = Quartz.NSEvent.mouseLocation(); print(int(loc.x), int(loc.y))\\""
return "window_pos:" & item 1 of winPos & "," & item 2 of winPos & " window_size:" & item 1 of winSize & "x" & item 2 of winSize & " mouse:" & mouseX
"""], capture_output=True, text=True)

print(r.stdout.strip() or r.stderr.strip())
