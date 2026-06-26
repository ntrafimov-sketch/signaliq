import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../dist');

const API_KEY = process.env.WEBHOOK_API_KEY || 'signaliq-dev-key';
const API_KEY_CLAY = process.env.WEBHOOK_API_KEY_CLAY || 'signaliq-clay-key';

function isValidKey(key: unknown): boolean {
  return key === API_KEY || key === API_KEY_CLAY;
}
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: 'text/plain', limit: '10mb' }));

// Connected browser clients
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

function broadcast(event: string, data: unknown) {
  const msg = JSON.stringify({ event, data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, clients: clients.size });
});

// Clay webhook — receives torpedo JSON for an account
app.post('/api/enrich', (req, res) => {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!isValidKey(key)) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  const body = req.body;

  // Accept either {account_id, company_name, data} or raw array from Clay
  let account_id: string;
  let company_name: string;
  let data: unknown[];

  if (Array.isArray(body)) {
    // Clay sends raw array — extract company info from company_intel entry
    data = body;
    const intel = body.find((e: { type?: string }) => e.type === 'company_intel') as { data?: { domain?: string; name?: string } } | undefined;
    account_id = intel?.data?.domain || `account-${Date.now()}`;
    company_name = intel?.data?.name || 'Unknown';
  } else {
    // data field may be a stringified JSON array — parse it
    const rawData = body.data;
    if (typeof rawData === 'string') {
      try { data = JSON.parse(rawData); } catch { data = []; }
    } else {
      data = rawData;
    }
    account_id = body.account_id || body.domain || `account-${Date.now()}`;
    company_name = body.company_name || body.name || 'Unknown';
  }

  console.log('[server] received body keys:', Object.keys(body));
  console.log('[server] data type:', typeof data, 'isArray:', Array.isArray(data), 'length:', Array.isArray(data) ? data.length : 'n/a');
  if (Array.isArray(data)) {
    console.log('[server] entry types:', data.map((e: unknown) => (e as { type?: string })?.type));
  }

  if (!data) {
    res.status(400).json({ error: 'data is required' });
    return;
  }

  // Push to all connected browsers
  broadcast('enrich', { account_id, company_name, data });

  res.json({ ok: true, pushed_to: clients.size });
});

// Clay webhook — receives generated outreach sequence for a person
app.post('/api/sequence-result', (req, res) => {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!isValidKey(key)) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  const { account_id, person_id } = req.body;
  let { sequence } = req.body;

  if (!account_id || !person_id || !sequence) {
    res.status(400).json({ error: 'account_id, person_id, and sequence are required' });
    return;
  }

  // Clay may send sequence as a JSON string — parse it
  if (typeof sequence === 'string') {
    try {
      const match = sequence.match(/\[[\s\S]*\]/);
      sequence = JSON.parse(match ? match[0] : sequence);
    } catch {
      res.status(400).json({ error: 'sequence must be a valid JSON array' });
      return;
    }
  }

  broadcast('sequence', { account_id, person_id, sequence });
  console.log(`[server] sequence result pushed for person ${person_id} @ account ${account_id}`);

  res.json({ ok: true, pushed_to: clients.size });
});

// Serve React frontend
app.use(express.static(distDir));
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(distDir, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`SignalIQ backend running on port ${PORT}`);
  console.log(`Webhook URL: POST /api/enrich`);
  console.log(`API key: ${API_KEY}`);
});
