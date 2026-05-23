import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { createServer } from 'node:http';
import QRCode from 'qrcode';

const PORT = Number(process.env.PORT ?? 5180);
const DATA_DIR = process.env.LOTTOMAX_DATA_DIR ?? './data';
const DB_FILE = join(DATA_DIR, 'lottomax.json');
const PUBLIC_DIR = resolve('./dist');
const PLATFORM_FEE_RATE = 0.15;
const PAYMENT_PROVIDER = process.env.LOTTOMAX_PAYMENT_PROVIDER ?? 'manual-provider';
const COMPANY_UPI_ID = process.env.LOTTOMAX_COMPANY_UPI_ID ?? 'lottomax@upi';
const COMPANY_PAYEE_NAME = process.env.LOTTOMAX_COMPANY_PAYEE_NAME ?? 'LottoMax';

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
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    kycStatus: user.kycStatus,
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
    qrCodeUrl: `/api/payments/orders/${order.id}/qr`
  };
}

function parseBody(request) {
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
    return json(response, 200, { ok: true, provider: PAYMENT_PROVIDER, at: now() });
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

  const body = await parseBody(request);

  if (method === 'POST' && pathname === '/api/auth/register') {
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
      accountStatus: 'ACTIVE',
      riskLevel: 'LOW',
      notes: [],
      passwordHash: hashPassword(body.password),
      wallet: { id: id('wallet'), balance: 0, currency: 'INR' },
      createdAt: now()
    };
    const token = id('session');
    db.users.push(user);
    db.sessions[token] = user.id;
    writeDb(db);
    return json(response, 201, { token, ...statePayload(db, user) });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const user = db.users.find((item) => item.email === String(body.email ?? '').toLowerCase());
    if (!user || !verifyPassword(body.password ?? '', user.passwordHash)) {
      throw Object.assign(new Error('Invalid email or password'), { status: 401 });
    }
    if ((user.accountStatus ?? 'ACTIVE') === 'SUSPENDED') {
      throw Object.assign(new Error('Player account is suspended'), { status: 403 });
    }
    const token = id('session');
    db.sessions[token] = user.id;
    user.lastLoginAt = now();
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
      method: body.method ?? 'UPI',
      status: 'PENDING_PROVIDER_CONFIRMATION',
      provider: PAYMENT_PROVIDER,
      upiPayee: COMPANY_UPI_ID,
      upiPayload: '',
      providerReference: '',
      createdAt: now()
    };
    paymentOrder.upiPayload = paymentUpiPayload(paymentOrder);
    db.payments.push(paymentOrder);
    writeDb(db);
    return json(response, 201, { paymentOrder: paymentOrderView(paymentOrder), ...statePayload(db, user) });
  }

  if (method === 'POST' && pathname === '/api/payments/confirm') {
    const user = requireUser(db, body.token);
    const order = db.payments.find((payment) => payment.id === body.orderId && payment.userId === user.id);
    if (!order) throw Object.assign(new Error('Payment order not found'), { status: 404 });
    if (order.status !== 'PENDING_PROVIDER_CONFIRMATION') throw Object.assign(new Error('Payment order is already processed'), { status: 409 });
    if (!body.providerReference || String(body.providerReference).trim().length < 6) {
      throw Object.assign(new Error('Provider payment reference is required after payment gateway success'), { status: 400 });
    }
    order.status = 'CAPTURED';
    order.providerReference = String(body.providerReference).trim();
    order.capturedAt = now();
    creditWallet(db, user, order.amount, `Wallet top-up via ${order.method}`, { paymentId: order.id, providerReference: order.providerReference });
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
