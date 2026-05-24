import { createHash, createHmac, createPublicKey, randomBytes, verify as verifySignature } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { request as httpsRequest } from 'node:https';
import { extname, join, resolve } from 'node:path';
import { createServer } from 'node:http';
import QRCode from 'qrcode';

const PORT = Number(process.env.PORT ?? 5180);
const DATA_DIR = process.env.LOTTOMAX_DATA_DIR ?? './data';
const DB_FILE = join(DATA_DIR, 'lottomax.json');
const PUBLIC_DIR = resolve('./dist');

loadLocalEnv();

const PLATFORM_FEE_RATE = 0.15;
const PAYMENT_PROVIDER = process.env.LOTTOMAX_PAYMENT_PROVIDER ?? 'razorpay';
const COMPANY_UPI_ID = process.env.LOTTOMAX_COMPANY_UPI_ID ?? 'lottomax@upi';
const COMPANY_PAYEE_NAME = process.env.LOTTOMAX_COMPANY_PAYEE_NAME ?? 'LottoMax';
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';
const ALLOW_RAZORPAY_TEST_CAPTURE = process.env.LOTTOMAX_ALLOW_RAZORPAY_TEST_CAPTURE !== 'false';
const CIAM_PROVIDER = process.env.CIAM_PROVIDER ?? 'auth0';
const CIAM_ISSUER_URL = normalizeIssuer(process.env.CIAM_ISSUER_URL ?? process.env.AUTH0_ISSUER_URL ?? '');
const CIAM_CLIENT_ID = process.env.CIAM_CLIENT_ID ?? process.env.AUTH0_CLIENT_ID ?? '';
const CIAM_CLIENT_SECRET = process.env.CIAM_CLIENT_SECRET ?? process.env.AUTH0_CLIENT_SECRET ?? '';
const CIAM_AUDIENCE = process.env.CIAM_AUDIENCE ?? process.env.AUTH0_AUDIENCE ?? CIAM_CLIENT_ID;
const CIAM_REDIRECT_URI = process.env.CIAM_REDIRECT_URI ?? 'http://localhost:5180';
const CIAM_SCOPE = process.env.CIAM_SCOPE ?? 'openid profile email phone';
const CIAM_KYC_CLAIM = process.env.CIAM_KYC_CLAIM ?? 'https://lottomax.example.com/kyc_status';
const CIAM_ROLE_CLAIM = process.env.CIAM_ROLE_CLAIM ?? 'https://lottomax.example.com/roles';
const CIAM_DEV_LOGIN_ENABLED = process.env.CIAM_DEV_LOGIN_ENABLED
  ? process.env.CIAM_DEV_LOGIN_ENABLED === 'true'
  : !CIAM_ISSUER_URL;
const ciamCache = { discovery: null, jwks: null, loadedAt: 0 };

const GROUP_PRESETS = [
  { id: 'group-5', title: '5 Player Rush', size: 5, entryFee: 250 },
  { id: 'group-10', title: '10 Player Prime', size: 10, entryFee: 500 },
  { id: 'group-15', title: '15 Player Max', size: 15, entryFee: 1000 },
  { id: 'group-20', title: '20 Player Royale', size: 20, entryFee: 2500 }
];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function now() {
  return new Date().toISOString();
}

function normalizeIssuer(value) {
  if (!value) return '';
  return value.endsWith('/') ? value : `${value}/`;
}

function loadLocalEnv() {
  const envPath = resolve('.env');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function id(prefix) {
  return `${prefix}_${randomBytes(9).toString('hex')}`;
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = createHash('sha256').update(`${salt}:${password}`).digest('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt] = stored.split(':');
  return hashPassword(password, salt) === stored;
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function decodeJwtPart(part) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

function decodeJwt(token) {
  const [header, payload, signature] = String(token).split('.');
  if (!header || !payload || !signature) throw Object.assign(new Error('Invalid CIAM token'), { status: 401 });
  return {
    header: decodeJwtPart(header),
    payload: decodeJwtPart(payload),
    signed: `${header}.${payload}`,
    signature: Buffer.from(signature, 'base64url')
  };
}

function makeGroup(preset) {
  return {
    ...preset,
    status: 'OPEN',
    prizePool: preset.entryFee * preset.size,
    escrowBalance: 0,
    players: [],
    winnerNumber: null,
    winnerName: '',
    platformFee: 0,
    winnerPayout: 0,
    drawLog: ['Group opened. Waiting for funded players.']
  };
}

function initialState() {
  return {
    users: [],
    sessions: {},
    groups: GROUP_PRESETS.map(makeGroup),
    payments: [],
    ledger: [],
    companyWallet: {
      id: 'wallet_company',
      name: 'LottoMax Company Wallet',
      balance: 0
    }
  };
}

function readDb() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(DB_FILE)) writeFileSync(DB_FILE, JSON.stringify(initialState(), null, 2));
  return JSON.parse(readFileSync(DB_FILE, 'utf8'));
}

function writeDb(db) {
  writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function json(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function svg(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  response.end(payload);
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    ciamSubject: user.ciamSubject ?? null,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    kycStatus: user.kycStatus,
    mfaVerified: user.mfaVerified ?? false,
    accountStatus: user.accountStatus ?? 'ACTIVE',
    riskLevel: user.riskLevel ?? 'LOW',
    notes: user.notes ?? [],
    lastLoginAt: user.lastLoginAt ?? null,
    wallet: user.wallet,
    createdAt: user.createdAt
  };
}

function statePayload(db, user = null) {
  return {
    user: publicUser(user),
    users: db.users.map(publicUser),
    groups: db.groups,
    companyWallet: db.companyWallet,
    payments: user ? db.payments.filter((payment) => payment.userId === user.id).slice(-10).reverse().map(paymentOrderView) : [],
    transactions: user ? db.ledger.filter((entry) => entry.userId === user.id).slice(-20).reverse() : []
  };
}

function paymentUpiPayload(order) {
  const params = new URLSearchParams({
    pa: COMPANY_UPI_ID,
    pn: COMPANY_PAYEE_NAME,
    am: Number(order.amount).toFixed(2),
    cu: order.currency,
    tn: `LottoMax wallet top-up ${order.id}`,
    tr: order.id
  });
  return `upi://pay?${params.toString()}`;
}

function paymentOrderView(order) {
  if (!order) return null;
  return {
    ...order,
    upiPayload: order.upiPayload ?? paymentUpiPayload(order),
    qrCodeUrl: `/api/payments/orders/${order.id}/qr`,
    razorpay: order.razorpayOrderId ? {
      keyId: RAZORPAY_KEY_ID,
      orderId: order.razorpayOrderId,
      amountPaise: order.amountPaise,
      currency: order.currency,
      name: COMPANY_PAYEE_NAME,
      description: `LottoMax wallet top-up ${order.id}`
    } : null
  };
}

function razorpayConfigured() {
  return Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);
}

function razorpayTestMode() {
  return RAZORPAY_KEY_ID.startsWith('rzp_test_');
}

function razorpayRequest(pathname, payload) {
  if (!razorpayConfigured()) {
    throw Object.assign(new Error('Razorpay keys are not configured on the server'), { status: 503 });
  }

  return new Promise((resolveRequest, rejectRequest) => {
    const body = JSON.stringify(payload);
    const request = httpsRequest({
      hostname: 'api.razorpay.com',
      path: pathname,
      method: 'POST',
      auth: `${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (razorpayResponse) => {
      let responseBody = '';
      razorpayResponse.on('data', (chunk) => {
        responseBody += chunk;
      });
      razorpayResponse.on('end', () => {
        const parsed = responseBody ? JSON.parse(responseBody) : {};
        if (razorpayResponse.statusCode >= 200 && razorpayResponse.statusCode < 300) {
          resolveRequest(parsed);
          return;
        }
        rejectRequest(Object.assign(new Error(parsed.error?.description ?? 'Razorpay request failed'), { status: 502 }));
      });
    });
    request.on('error', (error) => {
      rejectRequest(Object.assign(new Error(`Razorpay network error: ${error.message}`), { status: 502 }));
    });
    request.write(body);
    request.end();
  });
}

async function createRazorpayOrder(paymentOrder) {
  const amountPaise = Math.round(paymentOrder.amount * 100);
  const razorpayOrder = await razorpayRequest('/v1/orders', {
    amount: amountPaise,
    currency: paymentOrder.currency,
    receipt: paymentOrder.id,
    notes: {
      lottomaxPaymentId: paymentOrder.id,
      userId: paymentOrder.userId
    }
  });
  return {
    razorpayOrderId: razorpayOrder.id,
    amountPaise,
    providerOrderStatus: razorpayOrder.status
  };
}

function verifyRazorpayPaymentSignature({ razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  if (!razorpayConfigured()) {
    throw Object.assign(new Error('Razorpay keys are not configured on the server'), { status: 503 });
  }
  const expected = createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  return expected === razorpaySignature;
}

function verifyRazorpayWebhookSignature(rawBody, signature) {
  if (!RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');
  return expected === signature;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(payload.error_description ?? payload.error ?? `Request failed: ${url}`), {
      status: response.status >= 500 ? 502 : response.status
    });
  }
  return payload;
}

async function getCiamDiscovery() {
  if (!CIAM_ISSUER_URL) throw Object.assign(new Error('CIAM issuer is not configured'), { status: 503 });
  if (ciamCache.discovery) return ciamCache.discovery;
  ciamCache.discovery = await fetchJson(`${CIAM_ISSUER_URL}.well-known/openid-configuration`);
  return ciamCache.discovery;
}

async function getCiamJwks() {
  const stale = Date.now() - ciamCache.loadedAt > 10 * 60 * 1000;
  if (ciamCache.jwks && !stale) return ciamCache.jwks;
  const discovery = await getCiamDiscovery();
  ciamCache.jwks = await fetchJson(discovery.jwks_uri);
  ciamCache.loadedAt = Date.now();
  return ciamCache.jwks;
}

function validateAudience(payload) {
  if (!CIAM_AUDIENCE) return true;
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  return aud.includes(CIAM_AUDIENCE) || aud.includes(CIAM_CLIENT_ID);
}

async function verifyCiamJwt(token) {
  const decoded = decodeJwt(token);
  if (decoded.header.alg !== 'RS256') {
    throw Object.assign(new Error('Only RS256 CIAM tokens are accepted'), { status: 401 });
  }
  const jwks = await getCiamJwks();
  const jwk = jwks.keys?.find((key) => key.kid === decoded.header.kid);
  if (!jwk) throw Object.assign(new Error('CIAM signing key not found'), { status: 401 });
  const publicKey = createPublicKey({ key: jwk, format: 'jwk' });
  const valid = verifySignature('RSA-SHA256', Buffer.from(decoded.signed), publicKey, decoded.signature);
  if (!valid) throw Object.assign(new Error('CIAM token signature verification failed'), { status: 401 });
  const payload = decoded.payload;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.iss !== CIAM_ISSUER_URL) throw Object.assign(new Error('CIAM token issuer mismatch'), { status: 401 });
  if (payload.exp <= nowSeconds) throw Object.assign(new Error('CIAM token has expired'), { status: 401 });
  if (!validateAudience(payload)) throw Object.assign(new Error('CIAM token audience mismatch'), { status: 401 });
  return payload;
}

async function exchangeCiamCode({ code, codeVerifier, redirectUri }) {
  if (!CIAM_ISSUER_URL || !CIAM_CLIENT_ID) {
    throw Object.assign(new Error('CIAM issuer and client ID must be configured'), { status: 503 });
  }
  const discovery = await getCiamDiscovery();
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CIAM_CLIENT_ID,
    code,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri || CIAM_REDIRECT_URI
  });
  if (CIAM_CLIENT_SECRET) params.set('client_secret', CIAM_CLIENT_SECRET);
  return fetchJson(discovery.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
}

function ciamUserFromClaims(claims) {
  const roles = claims[CIAM_ROLE_CLAIM] ?? claims.roles ?? [];
  const roleList = Array.isArray(roles) ? roles : String(roles).split(/\s*,\s*/);
  return {
    ciamSubject: claims.sub,
    name: claims.name ?? claims.nickname ?? claims.email ?? 'Verified player',
    email: claims.email ?? '',
    phone: claims.phone_number ?? '',
    role: roleList.includes('OWNER') || roleList.includes('admin') ? 'OWNER' : 'PLAYER',
    mfaVerified: claims.amr?.includes('mfa') || claims.acr?.includes('mfa') || claims[`${CIAM_KYC_CLAIM}_mfa`] === true,
    kycStatus: String(claims[CIAM_KYC_CLAIM] ?? claims.kyc_status ?? 'PENDING').toUpperCase()
  };
}

function parseBody(request, { raw = false } = {}) {
  return new Promise((resolveBody, rejectBody) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        rejectBody(new Error('Request body too large'));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (raw) return resolveBody(body);
      if (!body) return resolveBody({});
      try {
        resolveBody(JSON.parse(body));
      } catch {
        rejectBody(new Error('Invalid JSON body'));
      }
    });
  });
}

function requireUser(db, token) {
  const userId = db.sessions[token];
  const user = db.users.find((item) => item.id === userId);
  if (!user) throw Object.assign(new Error('Sign in required'), { status: 401 });
  return user;
}

function upsertCiamUser(db, identity) {
  let user = db.users.find((item) => item.ciamSubject === identity.ciamSubject || (identity.email && item.email === identity.email.toLowerCase()));
  if (!user) {
    user = {
      id: id('user'),
      ciamSubject: identity.ciamSubject,
      name: identity.name,
      email: identity.email.toLowerCase(),
      phone: identity.phone,
      role: db.users.length === 0 || identity.role === 'OWNER' ? 'OWNER' : 'PLAYER',
      kycStatus: identity.kycStatus,
      accountStatus: 'ACTIVE',
      riskLevel: identity.mfaVerified ? 'LOW' : 'MEDIUM',
      mfaVerified: identity.mfaVerified,
      notes: [],
      passwordHash: '',
      wallet: { id: id('wallet'), balance: 0, currency: 'INR' },
      createdAt: now()
    };
    db.users.push(user);
  } else {
    user.ciamSubject = identity.ciamSubject;
    user.name = identity.name || user.name;
    user.email = identity.email?.toLowerCase() || user.email;
    user.phone = identity.phone || user.phone;
    user.kycStatus = identity.kycStatus || user.kycStatus;
    user.mfaVerified = identity.mfaVerified;
    user.riskLevel = identity.mfaVerified ? (user.riskLevel === 'HIGH' ? 'HIGH' : 'LOW') : 'MEDIUM';
    if (identity.role === 'OWNER') user.role = 'OWNER';
  }
  user.lastLoginAt = now();
  return user;
}

function createSession(db, user) {
  const token = id('session');
  db.sessions[token] = user.id;
  return token;
}

function requireOwner(db, token) {
  const user = requireUser(db, token);
  if (user.role !== 'OWNER') {
    throw Object.assign(new Error('Owner permission required'), { status: 403 });
  }
  return user;
}

function addLedger(db, entry) {
  db.ledger.push({
    id: id('ledger'),
    at: now(),
    ...entry
  });
}

function creditWallet(db, user, amount, note, metadata = {}) {
  user.wallet.balance += amount;
  addLedger(db, { userId: user.id, type: 'CREDIT', amount, note, metadata });
}

function debitWallet(db, user, amount, note, metadata = {}) {
  if (user.wallet.balance < amount) throw Object.assign(new Error('Insufficient wallet balance'), { status: 409 });
  user.wallet.balance -= amount;
  addLedger(db, { userId: user.id, type: 'DEBIT', amount, note, metadata });
}

function validateAgeConfirmed(body) {
  if (!body.ageConfirmed) {
    throw Object.assign(new Error('18+ age confirmation is required before real-money play'), { status: 400 });
  }
}

function canDraw(group) {
  return group.players.length === group.size && group.players.every((player) => player.number);
}

function settleDraw(db, group) {
  if (!canDraw(group)) throw Object.assign(new Error('Every funded player must pick a number before draw settlement'), { status: 409 });
  const winner = group.players[Math.floor(Math.random() * group.players.length)];
  const winnerUser = db.users.find((user) => user.id === winner.userId);
  const platformFee = Math.round(group.escrowBalance * PLATFORM_FEE_RATE);
  const winnerPayout = group.escrowBalance - platformFee;

  group.status = 'COMPLETED';
  group.winnerNumber = winner.number;
  group.winnerName = winner.name;
  group.platformFee = platformFee;
  group.winnerPayout = winnerPayout;
  group.drawLog = [
    `Draw settled. Number ${winner.number} won.`,
    `Winner payout: ${winnerPayout}. Platform fee: ${platformFee}.`,
    ...group.drawLog
  ];

  db.companyWallet.balance += platformFee;
  creditWallet(db, winnerUser, winnerPayout, `Won ${group.title}`, {
    groupId: group.id,
    grossPrize: group.escrowBalance,
    platformFee
  });
  addLedger(db, {
    userId: 'company',
    type: 'CREDIT',
    amount: platformFee,
    note: `15% LottoMax platform fee from ${group.title}`,
    metadata: { groupId: group.id, winnerUserId: winnerUser.id }
  });
}

async function handleApi(request, response, pathname) {
  const db = readDb();
  const method = request.method;
  const query = new URL(request.url, `http://${request.headers.host}`).searchParams;

  if (method === 'GET' && pathname === '/api/health') {
    return json(response, 200, {
      ok: true,
      provider: PAYMENT_PROVIDER,
      razorpayConfigured: razorpayConfigured(),
      razorpayTestMode: razorpayTestMode(),
      at: now()
    });
  }

  if (method === 'GET' && pathname === '/api/payments/config') {
    return json(response, 200, {
      provider: PAYMENT_PROVIDER,
      razorpayConfigured: razorpayConfigured(),
      razorpayKeyId: RAZORPAY_KEY_ID,
      razorpayTestMode: razorpayTestMode()
    });
  }

  if (method === 'GET' && pathname === '/api/ciam/config') {
    return json(response, 200, {
      provider: CIAM_PROVIDER,
      enabled: Boolean(CIAM_ISSUER_URL && CIAM_CLIENT_ID),
      issuerUrl: CIAM_ISSUER_URL,
      clientId: CIAM_CLIENT_ID,
      audience: CIAM_AUDIENCE,
      redirectUri: CIAM_REDIRECT_URI,
      scope: CIAM_SCOPE,
      devLoginEnabled: CIAM_DEV_LOGIN_ENABLED
    });
  }

  if (method === 'GET' && pathname === '/api/public-state') {
    return json(response, 200, statePayload(db));
  }

  if (method === 'GET' && pathname === '/api/state') {
    const user = requireUser(db, query.get('token'));
    return json(response, 200, statePayload(db, user));
  }

  const qrMatch = pathname.match(/^\/api\/payments\/orders\/([^/]+)\/qr$/);
  if (method === 'GET' && qrMatch) {
    const order = db.payments.find((payment) => payment.id === qrMatch[1]);
    if (!order) throw Object.assign(new Error('Payment order not found'), { status: 404 });
    const qr = await QRCode.toString(order.upiPayload ?? paymentUpiPayload(order), {
      type: 'svg',
      margin: 1,
      width: 240,
      color: {
        dark: '#050816',
        light: '#ffffff'
      }
    });
    return svg(response, 200, qr);
  }

  if (method === 'POST' && pathname === '/api/payments/razorpay-webhook') {
    const rawBody = await parseBody(request, { raw: true });
    if (!verifyRazorpayWebhookSignature(rawBody, request.headers['x-razorpay-signature'] ?? '')) {
      throw Object.assign(new Error('Invalid Razorpay webhook signature'), { status: 401 });
    }
    const event = JSON.parse(rawBody || '{}');
    const razorpayOrderId = event.payload?.payment?.entity?.order_id;
    const razorpayPaymentId = event.payload?.payment?.entity?.id;
    const order = db.payments.find((payment) => payment.razorpayOrderId === razorpayOrderId);
    if (order && order.status === 'PENDING_RAZORPAY_CAPTURE' && razorpayPaymentId) {
      const user = db.users.find((item) => item.id === order.userId);
      order.status = 'CAPTURED';
      order.providerReference = razorpayPaymentId;
      order.capturedAt = now();
      creditWallet(db, user, order.amount, 'Wallet top-up via Razorpay webhook', {
        paymentId: order.id,
        razorpayOrderId,
        razorpayPaymentId
      });
      writeDb(db);
    }
    return json(response, 200, { ok: true });
  }

  const body = await parseBody(request);

  if (method === 'POST' && pathname === '/api/auth/register') {
    if (!CIAM_DEV_LOGIN_ENABLED) {
      throw Object.assign(new Error('Local password registration is disabled. Use CIAM sign in.'), { status: 403 });
    }
    validateAgeConfirmed(body);
    if (!body.name || !body.email || !body.password) throw Object.assign(new Error('Name, email, and password are required'), { status: 400 });
    if (db.users.some((user) => user.email.toLowerCase() === body.email.toLowerCase())) {
      throw Object.assign(new Error('Email already registered'), { status: 409 });
    }
    const user = {
      id: id('user'),
      name: body.name,
      email: body.email.toLowerCase(),
      phone: body.phone ?? '',
      role: db.users.length === 0 ? 'OWNER' : 'PLAYER',
      kycStatus: 'BASIC_VERIFIED',
      mfaVerified: false,
      accountStatus: 'ACTIVE',
      riskLevel: 'LOW',
      notes: [],
      passwordHash: hashPassword(body.password),
      wallet: { id: id('wallet'), balance: 0, currency: 'INR' },
      createdAt: now()
    };
    db.users.push(user);
    const token = createSession(db, user);
    writeDb(db);
    return json(response, 201, { token, ...statePayload(db, user) });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    if (!CIAM_DEV_LOGIN_ENABLED) {
      throw Object.assign(new Error('Local password login is disabled. Use CIAM sign in.'), { status: 403 });
    }
    const user = db.users.find((item) => item.email === String(body.email ?? '').toLowerCase());
    if (!user || !verifyPassword(body.password ?? '', user.passwordHash)) {
      throw Object.assign(new Error('Invalid email or password'), { status: 401 });
    }
    if ((user.accountStatus ?? 'ACTIVE') === 'SUSPENDED') {
      throw Object.assign(new Error('Player account is suspended'), { status: 403 });
    }
    const token = createSession(db, user);
    user.lastLoginAt = now();
    writeDb(db);
    return json(response, 200, { token, ...statePayload(db, user) });
  }

  if (method === 'POST' && pathname === '/api/auth/ciam/exchange') {
    if (!body.code || !body.codeVerifier) {
      throw Object.assign(new Error('CIAM authorization code and PKCE verifier are required'), { status: 400 });
    }
    const tokenSet = await exchangeCiamCode({
      code: String(body.code),
      codeVerifier: String(body.codeVerifier),
      redirectUri: String(body.redirectUri || CIAM_REDIRECT_URI)
    });
    const claims = await verifyCiamJwt(tokenSet.id_token || tokenSet.access_token);
    const identity = ciamUserFromClaims(claims);
    if (!identity.mfaVerified) {
      throw Object.assign(new Error('CIAM MFA is required before wallet access'), { status: 403 });
    }
    const user = upsertCiamUser(db, identity);
    const token = createSession(db, user);
    writeDb(db);
    return json(response, 200, { token, ...statePayload(db, user) });
  }

  const statusMatch = pathname.match(/^\/api\/users\/([^/]+)\/status$/);
  if (method === 'POST' && statusMatch) {
    const owner = requireOwner(db, body.token);
    const target = db.users.find((item) => item.id === statusMatch[1]);
    if (!target) throw Object.assign(new Error('Player not found'), { status: 404 });
    const accountStatus = String(body.accountStatus ?? '').toUpperCase();
    if (!['ACTIVE', 'WATCHLIST', 'SUSPENDED'].includes(accountStatus)) {
      throw Object.assign(new Error('Invalid account status'), { status: 400 });
    }
    target.accountStatus = accountStatus;
    target.riskLevel = accountStatus === 'SUSPENDED' ? 'HIGH' : accountStatus === 'WATCHLIST' ? 'MEDIUM' : 'LOW';
    target.notes = [`${owner.name} set account status to ${accountStatus} at ${now()}`, ...(target.notes ?? [])].slice(0, 8);
    writeDb(db);
    return json(response, 200, statePayload(db, owner));
  }

  const kycMatch = pathname.match(/^\/api\/users\/([^/]+)\/kyc$/);
  if (method === 'POST' && kycMatch) {
    const owner = requireOwner(db, body.token);
    const target = db.users.find((item) => item.id === kycMatch[1]);
    if (!target) throw Object.assign(new Error('Player not found'), { status: 404 });
    const kycStatus = String(body.kycStatus ?? '').toUpperCase();
    if (!['PENDING', 'BASIC_VERIFIED', 'FULL_VERIFIED', 'REJECTED'].includes(kycStatus)) {
      throw Object.assign(new Error('Invalid KYC status'), { status: 400 });
    }
    target.kycStatus = kycStatus;
    target.notes = [`${owner.name} updated KYC to ${kycStatus} at ${now()}`, ...(target.notes ?? [])].slice(0, 8);
    writeDb(db);
    return json(response, 200, statePayload(db, owner));
  }

  const adjustMatch = pathname.match(/^\/api\/users\/([^/]+)\/wallet-adjustments$/);
  if (method === 'POST' && adjustMatch) {
    const owner = requireOwner(db, body.token);
    const target = db.users.find((item) => item.id === adjustMatch[1]);
    if (!target) throw Object.assign(new Error('Player not found'), { status: 404 });
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw Object.assign(new Error('Adjustment amount must be positive'), { status: 400 });
    const direction = String(body.direction ?? 'CREDIT').toUpperCase();
    const note = body.note?.trim() || `Owner wallet ${direction.toLowerCase()} adjustment`;
    if (direction === 'CREDIT') {
      creditWallet(db, target, amount, note, { ownerId: owner.id, manualAdjustment: true });
    } else if (direction === 'DEBIT') {
      debitWallet(db, target, amount, note, { ownerId: owner.id, manualAdjustment: true });
    } else {
      throw Object.assign(new Error('Invalid wallet adjustment direction'), { status: 400 });
    }
    target.notes = [`${owner.name} applied ${direction} ${amount} at ${now()}: ${note}`, ...(target.notes ?? [])].slice(0, 8);
    writeDb(db);
    return json(response, 200, statePayload(db, owner));
  }

  const notesMatch = pathname.match(/^\/api\/users\/([^/]+)\/notes$/);
  if (method === 'POST' && notesMatch) {
    const owner = requireOwner(db, body.token);
    const target = db.users.find((item) => item.id === notesMatch[1]);
    if (!target) throw Object.assign(new Error('Player not found'), { status: 404 });
    const note = String(body.note ?? '').trim();
    if (note.length < 3) throw Object.assign(new Error('Note is too short'), { status: 400 });
    target.notes = [`${owner.name}: ${note}`, ...(target.notes ?? [])].slice(0, 8);
    writeDb(db);
    return json(response, 200, statePayload(db, owner));
  }

  if (method === 'POST' && pathname === '/api/payments/orders') {
    const user = requireUser(db, body.token);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 100) throw Object.assign(new Error('Minimum wallet top-up is 100'), { status: 400 });
    const paymentOrder = {
      id: id('pay'),
      userId: user.id,
      amount,
      currency: 'INR',
      method: 'Razorpay Checkout',
      status: 'PENDING_RAZORPAY_CAPTURE',
      provider: PAYMENT_PROVIDER,
      upiPayee: COMPANY_UPI_ID,
      upiPayload: '',
      providerReference: '',
      createdAt: now()
    };
    paymentOrder.upiPayload = paymentUpiPayload(paymentOrder);
    if (PAYMENT_PROVIDER === 'razorpay') {
      Object.assign(paymentOrder, await createRazorpayOrder(paymentOrder));
    }
    db.payments.push(paymentOrder);
    writeDb(db);
    return json(response, 201, { paymentOrder: paymentOrderView(paymentOrder), ...statePayload(db, user) });
  }

  if (method === 'POST' && pathname === '/api/payments/confirm') {
    const user = requireUser(db, body.token);
    const order = db.payments.find((payment) => payment.id === body.orderId && payment.userId === user.id);
    if (!order) throw Object.assign(new Error('Payment order not found'), { status: 404 });
    if (order.status !== 'PENDING_RAZORPAY_CAPTURE' && order.status !== 'PENDING_PROVIDER_CONFIRMATION') {
      throw Object.assign(new Error('Payment order is already processed'), { status: 409 });
    }
    if (order.provider === 'razorpay') {
      const razorpayPaymentId = String(body.razorpayPaymentId ?? '');
      const razorpaySignature = String(body.razorpaySignature ?? '');
      if (!razorpayPaymentId || !razorpaySignature) {
        throw Object.assign(new Error('Razorpay payment ID and signature are required'), { status: 400 });
      }
      if (!verifyRazorpayPaymentSignature({
        razorpayOrderId: order.razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      })) {
        throw Object.assign(new Error('Razorpay signature verification failed'), { status: 401 });
      }
      order.providerReference = razorpayPaymentId;
      order.razorpaySignature = razorpaySignature;
    } else {
      if (!body.providerReference || String(body.providerReference).trim().length < 6) {
        throw Object.assign(new Error('Provider payment reference is required after payment gateway success'), { status: 400 });
      }
      order.providerReference = String(body.providerReference).trim();
    }
    order.status = 'CAPTURED';
    order.capturedAt = now();
    creditWallet(db, user, order.amount, `Wallet top-up via ${order.method}`, {
      paymentId: order.id,
      providerReference: order.providerReference,
      razorpayOrderId: order.razorpayOrderId
    });
    writeDb(db);
    return json(response, 200, statePayload(db, user));
  }

  if (method === 'POST' && pathname === '/api/payments/test-capture') {
    const user = requireUser(db, body.token);
    if (!ALLOW_RAZORPAY_TEST_CAPTURE || !razorpayTestMode()) {
      throw Object.assign(new Error('Razorpay test capture is only available with rzp_test keys'), { status: 403 });
    }
    const order = db.payments.find((payment) => payment.id === body.orderId && payment.userId === user.id);
    if (!order) throw Object.assign(new Error('Payment order not found'), { status: 404 });
    if (order.status !== 'PENDING_RAZORPAY_CAPTURE') {
      throw Object.assign(new Error('Payment order is already processed'), { status: 409 });
    }
    order.status = 'CAPTURED';
    order.providerReference = `test_capture_${order.razorpayOrderId}`;
    order.capturedAt = now();
    creditWallet(db, user, order.amount, 'Wallet top-up via Razorpay test capture', {
      paymentId: order.id,
      razorpayOrderId: order.razorpayOrderId,
      testCapture: true
    });
    writeDb(db);
    return json(response, 200, statePayload(db, user));
  }

  const joinMatch = pathname.match(/^\/api\/groups\/([^/]+)\/join$/);
  if (method === 'POST' && joinMatch) {
    const user = requireUser(db, body.token);
    const group = db.groups.find((item) => item.id === joinMatch[1]);
    if (!group) throw Object.assign(new Error('Group not found'), { status: 404 });
    if (group.status !== 'OPEN') throw Object.assign(new Error('Group is not open for joining'), { status: 409 });
    if (group.players.some((player) => player.userId === user.id)) throw Object.assign(new Error('You already joined this group'), { status: 409 });
    if (group.players.length >= group.size) throw Object.assign(new Error('Group is already full'), { status: 409 });
    debitWallet(db, user, group.entryFee, `Joined ${group.title}`, { groupId: group.id });
    group.escrowBalance += group.entryFee;
    group.players.push({ userId: user.id, name: user.name, number: null, joinedAt: now() });
    group.drawLog = [`${user.name} joined with funded entry.`, ...group.drawLog];
    if (group.players.length === group.size) {
      group.status = 'PICKING';
      group.drawLog = ['Group funded. Players must pick unique numbers.', ...group.drawLog];
    }
    writeDb(db);
    return json(response, 200, statePayload(db, user));
  }

  const pickMatch = pathname.match(/^\/api\/groups\/([^/]+)\/pick$/);
  if (method === 'POST' && pickMatch) {
    const user = requireUser(db, body.token);
    const group = db.groups.find((item) => item.id === pickMatch[1]);
    if (!group) throw Object.assign(new Error('Group not found'), { status: 404 });
    if (!['OPEN', 'PICKING'].includes(group.status)) throw Object.assign(new Error('Numbers cannot be changed after draw settlement'), { status: 409 });
    const player = group.players.find((item) => item.userId === user.id);
    if (!player) throw Object.assign(new Error('Join this group before picking a number'), { status: 409 });
    const number = Number(body.number);
    if (!Number.isInteger(number) || number < 1 || number > group.size) throw Object.assign(new Error('Invalid number for this group'), { status: 400 });
    if (group.players.some((item) => item.userId !== user.id && item.number === number)) {
      throw Object.assign(new Error('Number is already taken'), { status: 409 });
    }
    player.number = number;
    group.drawLog = [`${user.name} locked number ${number}.`, ...group.drawLog];
    if (canDraw(group)) settleDraw(db, group);
    writeDb(db);
    return json(response, 200, statePayload(db, user));
  }

  const drawMatch = pathname.match(/^\/api\/groups\/([^/]+)\/draw$/);
  if (method === 'POST' && drawMatch) {
    const user = requireUser(db, body.token);
    const group = db.groups.find((item) => item.id === drawMatch[1]);
    if (!group) throw Object.assign(new Error('Group not found'), { status: 404 });
    if (group.status === 'COMPLETED') throw Object.assign(new Error('Group already settled'), { status: 409 });
    settleDraw(db, group);
    writeDb(db);
    return json(response, 200, statePayload(db, user));
  }

  return json(response, 404, { error: 'Not found' });
}

function serveStatic(request, response, pathname) {
  const safePath = pathname === '/' ? '/index.html' : pathname;
  const filePath = resolve(join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) return json(response, 403, { error: 'Forbidden' });
  const target = existsSync(filePath) ? filePath : join(PUBLIC_DIR, 'index.html');
  const ext = extname(target);
  response.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
  response.end(readFileSync(target));
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (pathname.startsWith('/api/')) {
      await handleApi(request, response, pathname);
      return;
    }
    serveStatic(request, response, pathname);
  } catch (error) {
    json(response, error.status ?? 500, { error: error.message ?? 'Server error' });
  }
}).listen(PORT, () => {
  console.log(`LottoMax server listening on ${PORT}`);
});
