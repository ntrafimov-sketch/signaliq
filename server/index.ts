import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../dist');
const DATA_FILE = join(__dirname, 'data.json');
const JWT_SECRET = process.env.JWT_SECRET || 'signaliq-jwt-secret-2024';

const API_KEY = process.env.WEBHOOK_API_KEY || 'signaliq-dev-key';
const API_KEY_CLAY = process.env.WEBHOOK_API_KEY_CLAY || 'signaliq-clay-key';

function isValidKey(key: unknown): boolean {
  return key === API_KEY || key === API_KEY_CLAY;
}
const PORT = process.env.PORT || 3001;

// ── Persistent storage ──────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

interface ServerData {
  users: User[];
  accounts: unknown[];
}

function loadData(): ServerData {
  try {
    if (existsSync(DATA_FILE)) {
      return JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { users: [], accounts: [] };
}

// Strip only torpedoData (raw input JSON, ~200KB per account) and paywallScreenshot (binary).
// Everything else — people, news, adIntelligence, revenueHistory — is small and stays on server.
function stripHeavy(a: any) {
  if (!a || typeof a !== 'object') return a;
  const { torpedoData, paywallScreenshot, ...rest } = a;
  void torpedoData; void paywallScreenshot;
  return rest;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveData() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      const toSave = { users: db.users, accounts: (db.accounts as any[]).map(stripHeavy) };
      writeFileSync(DATA_FILE, JSON.stringify(toSave), 'utf-8');
    } catch (e) {
      console.error('[server] failed to save data:', e);
    }
  }, 2000);
}

const db: ServerData = loadData();
// Remove any stale enriching placeholders that should never have been persisted
const beforeClean = db.accounts.length;
db.accounts = (db.accounts as any[]).filter((a: any) => a.enrichmentStatus !== 'enriching');
if (db.accounts.length !== beforeClean) saveData();
console.log(`[server] loaded ${db.users.length} users, ${db.accounts.length} accounts from disk (cleaned ${beforeClean - db.accounts.length} enriching placeholders)`);

// ── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: 'text/plain', limit: '10mb' }));

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    (req as any).userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── WebSocket ────────────────────────────────────────────────────────────────

const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  // Send current accounts to new client
  ws.send(JSON.stringify({ event: 'init', data: { accounts: db.accounts } }));
  ws.on('close', () => clients.delete(ws));
});

function broadcast(event: string, data: unknown) {
  const msg = JSON.stringify({ event, data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

// ── Auth endpoints ───────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, clients: clients.size });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !name || !password) {
    res.status(400).json({ error: 'email, name, and password are required' });
    return;
  }
  if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user: User = {
    id: `user-${Date.now()}`,
    email: email.toLowerCase(),
    name,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  saveData();
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email.toLowerCase() === email?.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.users.find(u => u.id === (req as any).userId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ id: user.id, email: user.email, name: user.name });
});

// ── Accounts endpoints ───────────────────────────────────────────────────────

app.get('/api/accounts', requireAuth, (_req, res) => {
  res.json(db.accounts);
});

app.post('/api/accounts', requireAuth, (req, res) => {
  const account = stripHeavy(req.body);
  if (account.enrichmentStatus === 'enriching') { res.json({ ok: true, skipped: true }); return; }
  const existing = (db.accounts as any[]).findIndex((a: any) => a.id === account.id);
  if (existing >= 0) {
    (db.accounts as any[])[existing] = account;
  } else {
    db.accounts.push(account);
  }
  saveData();
  broadcast('accounts_updated', { accounts: db.accounts });
  res.json({ ok: true });
});

app.delete('/api/accounts/:id', requireAuth, (req, res) => {
  db.accounts = (db.accounts as any[]).filter((a: any) => a.id !== req.params.id);
  saveData();
  broadcast('accounts_updated', { accounts: db.accounts });
  res.json({ ok: true });
});

// ── LinkedIn photo proxy ─────────────────────────────────────────────────────

const photoCache = new Map<string, string | null>();

app.get('/api/linkedin-photo', async (req, res) => {
  const url = req.query.url as string;
  if (!url || !url.includes('linkedin.com/in/')) {
    res.status(400).json({ error: 'Invalid LinkedIn URL' });
    return;
  }

  if (photoCache.has(url)) {
    const cached = photoCache.get(url);
    if (cached) { res.redirect(cached); } else { res.status(404).end(); }
    return;
  }

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(5000),
    });
    const html = await resp.text();
    const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)
      || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/i);
    const photoUrl = match?.[1] || null;
    photoCache.set(url, photoUrl);
    if (photoUrl) { res.redirect(photoUrl); } else { res.status(404).end(); }
  } catch {
    photoCache.set(url, null);
    res.status(404).end();
  }
});

// ── Clay webhooks ────────────────────────────────────────────────────────────

app.post('/api/enrich', (req, res) => {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!isValidKey(key)) { res.status(401).json({ error: 'Invalid API key' }); return; }

  const body = req.body;
  let account_id: string, company_name: string, data: unknown[];

  if (Array.isArray(body)) {
    data = body;
    const intel = body.find((e: { type?: string }) => e.type === 'company_intel') as { data?: { domain?: string; name?: string } } | undefined;
    // domain may be "kicker.de / olympia-verlag.de" — take first value only
    const rawDomain = intel?.data?.domain || '';
    account_id = rawDomain.split(/[\s,/|]+/).map((s: string) => s.trim()).filter(Boolean)[0] || `account-${Date.now()}`;
    company_name = intel?.data?.name || 'Unknown';
  } else {
    const rawData = body.data;
    if (typeof rawData === 'string') {
      try { data = JSON.parse(rawData); } catch { data = []; }
    } else if (Array.isArray(rawData)) {
      data = rawData;
    } else if (rawData && typeof rawData === 'object') {
      data = rawData;
    } else {
      // Clay may send flat fields without a `data` wrapper — wrap into company_intel
      const { account_id: _aid, company_name: _cn, ...rest } = body as Record<string, unknown>;
      void _aid; void _cn;
      data = [{ type: 'company_intel', data: rest }];
    }
    account_id = body.account_id || body.domain || (body as any).Domain || `account-${Date.now()}`;
    company_name = body.company_name || body.name || (body as any).Name || 'Unknown';
  }

  if (!data) { res.status(400).json({ error: 'data is required' }); return; }

  // Respond immediately so Clay doesn't timeout, then broadcast
  res.json({ ok: true });
  console.log('[enrich] account_id:', account_id, 'company_name:', company_name);
  setImmediate(() => broadcast('enrich', { account_id, company_name, data }));
});

app.post('/api/sequence-result', (req, res) => {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (!isValidKey(key)) { res.status(401).json({ error: 'Invalid API key' }); return; }

  const { account_id, person_id } = req.body;
  let { result } = req.body;

  if (!account_id || !person_id || !result) {
    res.status(400).json({ error: 'account_id, person_id, and result are required' });
    return;
  }
  if (typeof result === 'string') {
    try { result = JSON.parse(result); } catch {
      res.status(400).json({ error: 'result must be valid JSON' }); return;
    }
  }

  broadcast('sequence', { account_id, person_id, result });
  console.log(`[server] sequence result pushed for person ${person_id} @ account ${account_id}`);

  res.json({ ok: true, pushed_to: clients.size });
});

// ── Frontend ─────────────────────────────────────────────────────────────────

app.use(express.static(distDir));
app.get('/{*path}', (_req, res) => {
  res.sendFile(join(distDir, 'index.html'));
});

// Suppress noisy "request aborted" errors from body-parser when clients disconnect
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'request.aborted' || err?.message === 'request aborted') return;
  next(err);
});

server.listen(PORT, () => {
  console.log(`SignalIQ backend running on port ${PORT}`);
  console.log(`API key: ${API_KEY}`);
});
