import json, os
path = os.path.expanduser('~/Library/Application Support/Claude/claude_desktop_config.json')
with open(path) as f:
    config = json.load(f)
config['mcpServers'] = {
    'appmagic': {
        'command': '/Users/polinalykhvar/.local/share/uv/python/cpython-3.10-macos-aarch64-none/bin/python3.10',
        'args': ['/Users/polinalykhvar/signaliq/servertest.py']
    }
}
with open(path, 'w') as f:
    json.dump(config, f, indent=2)
print('Done')
