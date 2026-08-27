import { Client } from 'pg';

type HyperdriveBinding = { connectionString: string };

type Env = {
  HYPERDRIVE: HyperdriveBinding;
  JWT_SECRET: string;
  ALLOWED_ORIGINS?: string;
};

type Json = Record<string, unknown> | unknown[];

const encoder = new TextEncoder();

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  return {
    'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0] || 'https://khaacho.com',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(request: Request, env: Env, data: Json, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request, env),
    },
  });
}

async function withDb<T>(env: Env, fn: (db: Client) => Promise<T>): Promise<T> {
  const db = new Client({ connectionString: env.HYPERDRIVE.connectionString });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const body = base64Url(encoder.encode(JSON.stringify({ ...payload, iat: now, exp: now + 60 * 60 * 24 * 7 })));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`)));
  return `${header}.${body}.${base64Url(signature)}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const iterations = 120_000;
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    keyMaterial,
    256,
  );
  return `pbkdf2$sha256$${iterations}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.startsWith('pbkdf2$sha256$')) return false;
  const [, , iterationsRaw, saltHex, hashHex] = stored.split('$');
  const iterations = Number(iterationsRaw);
  if (!iterations || !saltHex || !hashHex) return false;

  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations },
    keyMaterial,
    256,
  );
  const actual = new Uint8Array(bits);
  const expected = hexToBytes(hashHex);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

function normalizeEmail(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value: unknown): string {
  return String(value || '').trim().replace(/\s+/g, '');
}

async function customerRegister(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);
  const password = String(body.password || '');
  const name = String(body.name || '').trim();

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return json(request, env, { message: 'Valid email is required' }, 400);
  if (!phone || phone.length < 7) return json(request, env, { message: 'Valid phone is required' }, 400);
  if (password.length < 8) return json(request, env, { message: 'Password must be at least 8 characters' }, 400);
  if (!name) return json(request, env, { message: 'Name is required' }, 400);

  const passwordHash = await hashPassword(password);
  const id = crypto.randomUUID();

  try {
    const user = await withDb(env, async (db) => {
      const existing = await db.query('SELECT id FROM "User" WHERE email = $1 OR phone = $2 LIMIT 1', [email, phone]);
      if (existing.rowCount) return null;

      const result = await db.query(
        'INSERT INTO "User" (id, phone, name, email, password, "createdAt") VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, name, email',
        [id, phone, name, email, passwordHash],
      );
      return result.rows[0];
    });

    if (!user) return json(request, env, { message: 'Email or phone already registered' }, 409);
    const accessToken = await signJwt({ sub: user.id, email: user.email, role: 'CUSTOMER' }, env.JWT_SECRET);
    return json(request, env, { access_token: accessToken, user: { ...user, role: 'CUSTOMER' } }, 201);
  } catch (error) {
    console.error('customer-register failed', error);
    return json(request, env, { message: 'Registration failed' }, 500);
  }
}

async function customerLogin(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password) return json(request, env, { message: 'Email and password are required' }, 400);

  try {
    const user = await withDb(env, async (db) => {
      const result = await db.query('SELECT id, name, email, password FROM "User" WHERE email = $1 LIMIT 1', [email]);
      return result.rows[0] || null;
    });

    if (!user || !user.password) return json(request, env, { message: 'Invalid credentials' }, 401);
    if (!user.password.startsWith('pbkdf2$sha256$')) {
      return json(request, env, { message: 'Existing account needs a password reset before Cloudflare login can be used' }, 409);
    }
    if (!(await verifyPassword(password, user.password))) return json(request, env, { message: 'Invalid credentials' }, 401);

    const accessToken = await signJwt({ sub: user.id, email: user.email, role: 'CUSTOMER' }, env.JWT_SECRET);
    return json(request, env, {
      access_token: accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: 'CUSTOMER' },
    });
  } catch (error) {
    console.error('customer-login failed', error);
    return json(request, env, { message: 'Login failed' }, 500);
  }
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function criteriaMultiplier(url: URL): number {
  const vertical = url.searchParams.get('vertical') || '';
  const age = Number(url.searchParams.get('age') || 0);
  const cc = Number(url.searchParams.get('cc') || 0);
  const sumAssured = Number(url.searchParams.get('sumAssured') || 0);
  const year = Number(url.searchParams.get('year') || 0);
  const smoker = url.searchParams.get('smoker') === 'true';
  const preExisting = url.searchParams.get('preExistingConditions') === 'true';

  let m = 1;
  if (vertical === 'motor') {
    if (cc > 150) m += Math.min((cc - 150) / 3000, 0.35);
    if (year && year < new Date().getFullYear() - 8) m += 0.12;
  } else if (vertical === 'health') {
    if (age > 40) m += Math.min((age - 40) * 0.012, 0.5);
    if (preExisting) m += 0.2;
  } else if (vertical === 'life') {
    if (age > 30) m += Math.min((age - 30) * 0.01, 0.45);
    if (smoker) m += 0.25;
    if (sumAssured > 0) m += Math.min(sumAssured / 20_000_000, 0.3);
  }
  return m;
}

async function getQuotes(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const vertical = (url.searchParams.get('vertical') || '').trim().toLowerCase();
  if (!vertical) return json(request, env, []);

  try {
    const partners = await withDb(env, async (db) => {
      const result = await db.query(
        'SELECT id, name, "claimRatio", verticals FROM "Partner" WHERE type::text = $1 AND active = TRUE',
        ['INSURER'],
      );
      return result.rows.filter((p) => Array.isArray(p.verticals) && p.verticals.map((v: unknown) => String(v).toLowerCase()).includes(vertical));
    });

    const multiplier = criteriaMultiplier(url);
    const quotes = partners.map((partner) => {
      const seed = hashString(String(partner.id));
      const basePremium = 5000 + (seed % 10000);
      const premiumValue = Math.round(basePremium * multiplier);
      const csrValue = partner.claimRatio ? Number(partner.claimRatio) : 85 + ((seed >>> 8) % 140) / 10;
      const plan = vertical === 'motor' ? 'Comprehensive' : vertical === 'health' ? 'Standard Health' : vertical === 'life' ? 'Term Life' : 'Standard Plan';
      const id = base64Url(encoder.encode(`${partner.name}-${plan}`));

      return {
        id,
        insurer: partner.name,
        plan,
        premium: `NPR ${premiumValue.toLocaleString('en-US')}`,
        premiumValue,
        coverage: vertical === 'motor' ? 'Own damage + third-party cover' : vertical === 'health' ? 'Hospitalization and emergency cover' : vertical === 'life' ? 'Life cover for selected sum assured' : 'Standard coverage',
        csr: `${csrValue.toFixed(1)}%`,
        exclusions: [],
        isBestMatch: false,
      };
    });

    quotes.sort((a, b) => a.premiumValue - b.premiumValue);
    if (quotes[0]) quotes[0].isBestMatch = true;
    return json(request, env, quotes);
  } catch (error) {
    console.error('quotes failed', error);
    return json(request, env, { message: 'Unable to load quotes' }, 500);
  }
}

async function health(request: Request, env: Env): Promise<Response> {
  try {
    const database = await withDb(env, async (db) => {
      const result = await db.query('SELECT 1 AS ok');
      return result.rows[0]?.ok === 1;
    });
    return json(request, env, { ok: true, service: 'khaacho-cloudflare-api', database });
  } catch (error) {
    console.error('health failed', error);
    return json(request, env, { ok: false, service: 'khaacho-cloudflare-api', database: false }, 503);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'GET' && (path === '/' || path === '/health' || path === '/api/health')) {
      return health(request, env);
    }
    if (request.method === 'POST' && (path === '/auth/customer-register' || path === '/api/auth/customer-register')) {
      return customerRegister(request, env);
    }
    if (request.method === 'POST' && (path === '/auth/customer-login' || path === '/api/auth/customer-login')) {
      return customerLogin(request, env);
    }
    if (request.method === 'GET' && (path === '/quotes' || path === '/api/quotes')) {
      return getQuotes(request, env);
    }

    return json(request, env, { message: 'Not found' }, 404);
  },
} satisfies ExportedHandler<Env>;
