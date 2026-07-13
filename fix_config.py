import json, os, subprocess, sys

# Find Python 3.10 installed by uv
uv = os.path.expanduser('~/.local/bin/uv')
try:
    py_path = subprocess.check_output([uv, 'python', 'find', '3.10'],
                                       stderr=subprocess.DEVNULL).decode().strip()
except Exception:
    print('ERROR: uv not found or Python 3.10 not installed.')
    print('Run: curl -LsSf https://astral.sh/uv/install.sh | sh')
    print('Then: ~/.local/bin/uv python install 3.10')
    sys.exit(1)

servertest = os.path.expanduser('~/signaliq/servertest.py')
config_path = os.path.expanduser('~/Library/Application Support/Claude/claude_desktop_config.json')

os.makedirs(os.path.dirname(config_path), exist_ok=True)
try:
    with open(config_path) as f:
        config = json.load(f)
except Exception:
    config = {}

config['mcpServers'] = {
    'appmagic': {
        'command': py_path,
        'args': [servertest]
    }
}

with open(config_path, 'w') as f:
    json.dump(config, f, indent=2)

print(f'Done!')
print(f'  Python: {py_path}')
print(f'  Server: {servertest}')
print()
print('Now restart Claude Desktop (Cmd+Q, then reopen).')
