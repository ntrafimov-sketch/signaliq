import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const API_KEY = process.env.WEBHOOK_API_KEY || 'signaliq-dev-key';
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

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
  if (key !== API_KEY) {
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  const { account_id, company_name, data } = req.body;
  if (!account_id || !data) {
    res.status(400).json({ error: 'account_id and data are required' });
    return;
  }

  // Push to all connected browsers
  broadcast('enrich', { account_id, company_name, data });

  res.json({ ok: true, pushed_to: clients.size });
});

server.listen(PORT, () => {
  console.log(`SignalIQ backend running on port ${PORT}`);
  console.log(`Webhook URL: POST /api/enrich`);
  console.log(`API key: ${API_KEY}`);
});
