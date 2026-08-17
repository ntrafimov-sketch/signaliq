import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';
const { Pool } = pg;

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, '../dist');
const JWT_SECRET = process.env.JWT_SECRET || 'signaliq-jwt-secret-2024';

// ── PostgreSQL ───────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway.internal') ? false : { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS torpedo_queue (
      id SERIAL PRIMARY KEY,
      account_id TEXT NOT NULL,
      company_name TEXT NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('[db] tables ready');
}

const API_KEY = process.env.WEBHOOK_API_KEY || 'signaliq-dev-key';
const API_KEY_CLAY = process.env.WEBHOOK_API_KEY_CLAY || 'signaliq-clay-key';

function isValidKey(key: unknown): boolean {
  return key === API_KEY || key === API_KEY_CLAY;
}
const PORT = process.env.PORT || 3001;

// ── Persistent storage (PostgreSQL) ─────────────────────────────────────────

interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

// Strip only torpedoData (raw input JSON, ~200KB per account) and paywallScreenshot (binary).
// Everything else — people, news, adIntelligence, revenueHistory — is small and stays on server.
function stripHeavy(a: any) {
  if (!a || typeof a !== 'object') return a;
  const { torpedoData, paywallScreenshot, ...rest } = a;
  void torpedoData; void paywallScreenshot;
  return rest;
}

// In-memory cache so WebSocket init is instant
let accountsCache: any[] = [];
let usersCache: User[] = [];

// In-memory torpedo queue (pending items not yet processed by any client)
let torpedoQueue: Array<{ id: number; account_id: string; company_name: string; data: unknown[] }> = [];

async function loadFromDb() {
  const [usersRes, accountsRes, queueRes] = await Promise.all([
    pool.query('SELECT id, email, name, password_hash, created_at FROM users'),
    pool.query('SELECT data FROM accounts WHERE (data->>\'enrichmentStatus\') != \'enriching\' OR (data->>\'enrichmentStatus\') IS NULL ORDER BY updated_at DESC'),
    pool.query('SELECT id, account_id, company_name, data FROM torpedo_queue ORDER BY created_at ASC'),
  ]);
  usersCache = usersRes.rows.map(r => ({ id: r.id, email: r.email, name: r.name, passwordHash: r.password_hash, createdAt: r.created_at }));
  accountsCache = accountsRes.rows.map(r => r.data);
  torpedoQueue = queueRes.rows.map(r => ({ id: r.id, account_id: r.account_id, company_name: r.company_name, data: r.data }));
  console.log(`[db] loaded ${usersCache.length} users, ${accountsCache.length} accounts, ${torpedoQueue.length} pending torpedo items`);
}

async function saveTorpedoToQueue(account_id: string, company_name: string, data: unknown[]) {
  // Remove old entries for same account to avoid duplicates
  await pool.query('DELETE FROM torpedo_queue WHERE account_id = $1', [account_id]);
  torpedoQueue = torpedoQueue.filter(t => t.account_id !== account_id);
  const res = await pool.query(
    'INSERT INTO torpedo_queue (account_id, company_name, data) VALUES ($1, $2, $3) RETURNING id',
    [account_id, company_name, JSON.stringify(data)]
  );
  const id = res.rows[0].id;
  torpedoQueue.push({ id, account_id, company_name, data });
  console.log(`[db] torpedo queued for ${company_name} (id=${id})`);
}

async function removeTorpedoFromQueue(account_id: string) {
  await pool.query('DELETE FROM torpedo_queue WHERE account_id = $1', [account_id]);
  torpedoQueue = torpedoQueue.filter(t => t.account_id !== account_id);
}

async function upsertAccount(account: any) {
  const clean = stripHeavy(account);
  await pool.query(
    `INSERT INTO accounts (id, data, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()`,
    [clean.id, JSON.stringify(clean)]
  );
  const idx = accountsCache.findIndex(a => a.id === clean.id);
  if (idx >= 0) accountsCache[idx] = clean; else accountsCache.push(clean);
}

async function deleteAccount(id: string) {
  await pool.query('DELETE FROM accounts WHERE id = $1', [id]);
  accountsCache = accountsCache.filter(a => a.id !== id);
}

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
  // Send current accounts to new client (from in-memory cache)
  ws.send(JSON.stringify({ event: 'init', data: { accounts: accountsCache } }));
  // Replay any pending torpedo items so client can process & save them
  for (const item of torpedoQueue) {
    ws.send(JSON.stringify({ event: 'enrich', data: { account_id: item.account_id, company_name: item.company_name, data: item.data } }));
  }
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
  if (usersCache.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user: User = { id: `user-${Date.now()}`, email: email.toLowerCase(), name, passwordHash, createdAt: new Date().toISOString() };
    await pool.query('INSERT INTO users (id, email, name, password_hash, created_at) VALUES ($1,$2,$3,$4,$5)',
      [user.id, user.email, user.name, user.passwordHash, user.createdAt]);
    usersCache.push(user);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) { res.status(500).json({ error: 'Registration failed' }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = usersCache.find(u => u.email.toLowerCase() === email?.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = usersCache.find(u => u.id === (req as any).userId);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ id: user.id, email: user.email, name: user.name });
});

// ── Accounts endpoints ───────────────────────────────────────────────────────

app.get('/api/accounts', requireAuth, (_req, res) => {
  res.json(accountsCache);
});

app.post('/api/accounts', requireAuth, async (req, res) => {
  const account = stripHeavy(req.body);
  if (account.enrichmentStatus === 'enriching') { res.json({ ok: true, skipped: true }); return; }
  try {
    await upsertAccount(account);
    // Remove from torpedo queue if present (client confirmed it processed this account)
    if (account.domain) removeTorpedoFromQueue(account.domain).catch(() => {});
    if (account.id) removeTorpedoFromQueue(account.id).catch(() => {});
    broadcast('accounts_updated', { accounts: accountsCache });
    console.log(`[db] saved account: ${account.company_name || account.id}`);
    res.json({ ok: true });
  } catch (e) { console.error('[db] upsert error:', e); res.status(500).json({ error: 'DB error' }); }
});

app.delete('/api/accounts/:id', requireAuth, async (req, res) => {
  try {
    await deleteAccount(String(req.params.id));
    broadcast('accounts_updated', { accounts: accountsCache });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'DB error' }); }
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

  // Respond immediately so Clay doesn't timeout
  res.json({ ok: true });
  console.log('[enrich] account_id:', account_id, 'company_name:', company_name);
  // Save to persistent queue so data survives server restarts and offline clients
  saveTorpedoToQueue(account_id, company_name, data as unknown[]).catch(e => console.error('[db] torpedo queue error:', e));
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

initDb()
  .then(() => loadFromDb())
  .then(() => {
    server.listen(PORT, () => {
      console.log(`SignalIQ backend running on port ${PORT}`);
      console.log(`API key: ${API_KEY}`);
    });
  })
  .catch(err => {
    console.error('[db] failed to init:', err);
    process.exit(1);
  });
