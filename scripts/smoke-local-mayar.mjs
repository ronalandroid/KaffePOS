#!/usr/bin/env node
/**
 * Local Mayar end-to-end smoke. Boots the backend against a scratch Postgres and a
 * fake Mayar API, then walks a POS QRIS order and a subscription through
 *   create payment (API key) → webhook (token) → API re-check → settlement.
 * It never calls the real Mayar API and never touches existing databases.
 *
 * Requires a LOCAL Postgres and a built backend:
 *   npm run smoke:local:mayar
 *   SMOKE_PG_URL_BASE=postgresql://postgres@127.0.0.1:5432 npm run smoke:local:mayar
 */
import http from 'node:http';
import { spawn, execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const DB_NAME = 'kaffepos_smoke_mayar';
const PORT = Number(process.env.SMOKE_PORT || 8911);
const MAYAR_PORT = Number(process.env.SMOKE_MAYAR_PORT || 8912);
const PG = process.env.SMOKE_PG_URL_BASE || 'postgresql://postgres@127.0.0.1:5432';
const DB = `${PG}/${DB_NAME}`;
const BASE = `http://127.0.0.1:${PORT}`;
const MAYAR_BASE = `http://127.0.0.1:${MAYAR_PORT}`;
const API_KEY = `smoke-api-key-${randomUUID()}`;
// Same shape as the Mayar dashboard "Web Token" (128 hex characters).
const WEBHOOK_TOKEN = `${randomUUID()}${randomUUID()}${randomUUID()}${randomUUID()}`.replace(/-/g, '');
const WEBHOOK_URL = `${BASE}/api/webhooks/mayar`;

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const psqlAdmin = (sql) => sh(`psql "${PG}/postgres" -tA -c ${JSON.stringify(sql)}`);
const psql = (sql) => sh(`psql "${DB}" -tA -c ${JSON.stringify(sql)}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// ── Fake Mayar Headless API v2 ────────────────────────────────────────────────
const fake = { payments: new Map(), webhookUrl: null, calls: [] };

function readJson(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); }
    });
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

const mayarServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, MAYAR_BASE);
  const body = await readJson(req);
  fake.calls.push({ method: req.method, path: url.pathname, body });
  if (req.headers.authorization !== `Bearer ${API_KEY}`) return send(res, 401, { statusCode: 401, messages: 'Unauthorized' });

  if (req.method === 'POST' && url.pathname === '/hl/v2/payments/create') {
    // Real payment requests may refuse redirectUrl; make the backend take its retry path.
    if (body.redirectUrl) return send(res, 400, { statusCode: 400, messages: 'redirectUrl is not supported on payment requests and was not saved' });
    const id = randomUUID();
    const payment = { id, transactionId: randomUUID(), status: 'unpaid', amount: body.amount, name: body.name, description: body.description };
    fake.payments.set(id, payment);
    return send(res, 200, { statusCode: 200, messages: 'success', data: { id, transactionId: payment.transactionId, link: `https://kaffepos.myr.id/pl/${id.slice(0, 8)}` } });
  }
  const detail = url.pathname.match(/^\/hl\/v2\/payments\/([^/]+)$/);
  if (req.method === 'GET' && detail) {
    const payment = fake.payments.get(detail[1]);
    if (!payment) return send(res, 404, { statusCode: 404, messages: 'Payment request not found' });
    return send(res, 200, {
      statusCode: 200,
      messages: 'success',
      data: {
        id: payment.id,
        type: 'payment_request',
        status: payment.status,
        amount: payment.amount,
        name: payment.name,
        description: payment.description,
        transactions: payment.status === 'paid' ? [{ id: payment.transactionId, status: 'paid', amount: payment.amount, updatedAt: Date.now() }] : [],
      },
    });
  }
  if (req.method === 'GET' && url.pathname === '/hl/v2/payments') return send(res, 200, { statusCode: 200, messages: 'success', data: [] });
  if (req.method === 'POST' && url.pathname === '/hl/v2/webhooks/update') {
    fake.webhookUrl = body.urlHook;
    return send(res, 200, { statusCode: 200, messages: 'success' });
  }
  if (req.method === 'POST' && url.pathname === '/hl/v2/webhooks/test') {
    // Like Mayar: the dashboard Web Token travels in the X-Callback-Token header.
    const hook = await fetch(body.urlHook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Callback-Token': WEBHOOK_TOKEN },
      body: JSON.stringify({ event: 'testing', data: { id: 'test-event' } }),
    }).catch(() => null);
    return send(res, hook?.ok ? 200 : 400, { statusCode: hook?.ok ? 200 : 400, messages: hook?.ok ? 'success' : `hook answered ${hook?.status ?? 'nothing'}` });
  }
  return send(res, 404, { statusCode: 404, messages: 'unknown endpoint' });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
async function api(path, { token, ...opts } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers ?? {}) },
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: response.status, body };
}

function webhookBody(payment, event = 'payment.received') {
  // No extraData on purpose: KaffePOS must map the event by productId alone.
  return {
    event,
    data: {
      id: payment.transactionId,
      transactionId: payment.transactionId,
      productId: payment.id,
      productType: 'payment_request',
      productName: payment.name,
      status: 'SUCCESS',
      transactionStatus: 'created',
      amount: payment.amount,
      customerEmail: 'buyer@example.com',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  };
}

function sendWebhook(body, { token = WEBHOOK_TOKEN, via = 'header' } = {}) {
  const path = via === 'query' ? `/api/webhooks/mayar?token=${encodeURIComponent(token)}` : '/api/webhooks/mayar';
  return api(path, {
    method: 'POST',
    headers: via === 'header' && token ? { 'X-Callback-Token': token } : {},
    body: JSON.stringify(body),
  });
}

let server = null;
let bootLog = '';
try {
  try { sh(`psql "${PG}/postgres" -tA -c "select 1"`); } catch {
    console.error(`Local Postgres is not reachable at ${PG}. Set SMOKE_PG_URL_BASE. Aborting.`);
    process.exit(2);
  }

  console.log(`→ provisioning scratch database ${DB_NAME}`);
  psqlAdmin(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  psqlAdmin(`CREATE DATABASE ${DB_NAME}`);
  sh(`psql "${DB}" -v ON_ERROR_STOP=1 -f database/base-schema.sql`);
  execSync(
    `node -e "const{bootstrapAllSchemas}=require('./dist/schema-bootstrap.js');const{pool}=require('./dist/core/db.js');bootstrapAllSchemas().then(async()=>{await pool.end();}).catch(async(e)=>{console.error(e.message);await pool.end();process.exit(1);})"`,
    { cwd: 'backend', env: { ...process.env, DATABASE_URL: DB, NODE_ENV: 'development' }, stdio: 'inherit' },
  );
  execSync('npm --prefix backend run migrate', { env: { ...process.env, DATABASE_URL: DB }, stdio: 'pipe' });
  check('scratch schema + migrations applied', true);

  await new Promise((resolve) => mayarServer.listen(MAYAR_PORT, '127.0.0.1', resolve));

  console.log('→ booting backend dist with Mayar sandbox pointed at the fake API');
  server = spawn('node', ['dist/index.js'], {
    cwd: 'backend',
    env: {
      ...process.env,
      DATABASE_URL: DB,
      NODE_ENV: 'development',
      PORT: String(PORT),
      LOG_LEVEL: 'info',
      PAYMENT_INTEGRATION_ENABLED: 'true',
      PAYMENT_GATEWAY_PROVIDER: 'mayar',
      SUBSCRIPTION_PAYMENT_MODE: 'auto',
      MAYAR_ENVIRONMENT: 'sandbox',
      MAYAR_SANDBOX_BASE_URL: MAYAR_BASE,
      MAYAR_API_KEY: API_KEY,
      MAYAR_WEBHOOK_TOKEN: WEBHOOK_TOKEN,
      MAYAR_CALLBACK_URL: WEBHOOK_URL,
      CORS_ORIGIN: 'http://localhost:5173',
      WEB_BASE_URL: 'http://localhost:5173',
      API_BASE_URL: BASE,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (chunk) => { bootLog += chunk; });
  server.stderr.on('data', (chunk) => { bootLog += chunk; });

  let healthy = false;
  for (let i = 0; i < 60 && !healthy; i += 1) {
    try { healthy = (await fetch(`${BASE}/health`)).ok; } catch { /* booting */ }
    if (!healthy) await sleep(300);
  }
  check('backend boots', healthy);
  if (!healthy) { console.error(bootLog.slice(-2000)); throw new Error('boot failed'); }

  const hookInfo = await api('/api/webhooks/mayar');
  check('GET /api/webhooks/mayar reports token configured', hookInfo.body?.webhookTokenConfigured === true);

  // Owner account + store + one product
  const email = 'smoke-mayar@test.local';
  const password = 'SmokeMayar123!';
  await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, username: 'smokemayar', display_name: 'Smoke Mayar', store_name: 'Smoke Kopi' }),
  });
  const code = psql(`select code from public.email_verification_codes where email='${email}' order by created_at desc limit 1`);
  await api('/api/auth/verification/confirm', { method: 'POST', body: JSON.stringify({ email, code }) });
  const login = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const token = login.body?.accessToken;
  check('owner login', Boolean(token), `status=${login.status}`);
  const stores = await api('/api/stores', { token });
  const storeId = stores.body?.items?.[0]?.id;
  check('store available', Boolean(storeId));
  const imported = await api('/api/inventory/bulk-import/commit', {
    method: 'POST',
    token,
    body: JSON.stringify({ store_id: storeId, mode: 'create_only', rows: [{ rowNumber: 1, kind: 'product', name: 'Kopi Susu Smoke', price: 25000, category: 'Coffee' }] }),
  });
  check('product created', imported.status === 201, `status=${imported.status}`);
  const menuItemId = psql(`select id from public.menu_items where name='Kopi Susu Smoke' limit 1`);

  // ── POS QRIS order ──────────────────────────────────────────────────────────
  const created = await api('/api/payment/create-transaction', {
    method: 'POST',
    token,
    body: JSON.stringify({ store_id: storeId, items: [{ menu_item_id: menuItemId, qty: 2 }], customer: { name: 'Budi' } }),
  });
  const orderId = created.body?.order_id;
  check('POS: Mayar payment link created with the API key', created.status === 201 && /myr\.id/.test(created.body?.payment_url ?? ''), `status=${created.status}`);
  const posRow = psql(`select provider || '|' || coalesce(provider_reference,'') || '|' || coalesce(metadata->>'providerTransactionId','') from public.payment_orders where merchant_order_id='${orderId}'`);
  const [posProvider, posReference, posTransactionId] = posRow.split('|');
  const posPayment = fake.payments.get(posReference);
  check('POS: order stores Mayar ids', posProvider === 'mayar' && Boolean(posPayment) && posTransactionId === posPayment?.transactionId);

  const noToken = await sendWebhook(webhookBody(posPayment), { token: '' });
  const wrongToken = await sendWebhook(webhookBody(posPayment), { token: 'wrong-token' });
  check('webhook without token → 401', noToken.status === 401, `status=${noToken.status}`);
  check('webhook with wrong token → 401', wrongToken.status === 401, `status=${wrongToken.status}`);

  const early = await sendWebhook(webhookBody(posPayment));
  check('forged "paid" webhook while Mayar says unpaid → 409', early.status === 409, `status=${early.status}`);
  check('POS order still pending', psql(`select status from public.payment_orders where merchant_order_id='${orderId}'`) === 'pending');

  posPayment.status = 'paid';
  const settled = await sendWebhook(webhookBody(posPayment), { via: 'query' });
  check('webhook (?token=) settles the POS order', settled.status === 200 && settled.body?.status === 'paid' && settled.body?.kind === 'pos', JSON.stringify(settled.body));
  const posAfter = psql(`select status || '|' || coalesce(transaction_id,'') from public.payment_orders where merchant_order_id='${orderId}'`).split('|');
  check('POS order completed with a transaction', posAfter[0] === 'completed' && Boolean(posAfter[1]));
  check('sale recorded once', psql(`select count(*) from public.transactions where id='${posAfter[1]}'`) === '1');
  const status = await api(`/api/payment/orders/${encodeURIComponent(orderId)}`, { token });
  check('POS status endpoint reports completed', status.body?.status === 'completed');

  const duplicate = await sendWebhook(webhookBody(posPayment));
  check('duplicate webhook acknowledged without re-settling', duplicate.status === 200 && duplicate.body?.duplicate === true);
  check('still exactly one sale', psql(`select count(*) from public.transactions where store_id='${storeId}'`) === '1');

  const membership = await sendWebhook({ event: 'membership.memberExpired', data: { id: 'm-1', status: 'SUCCESS' } });
  check('non-payment event acknowledged and ignored', membership.status === 200 && membership.body?.ignored === true);
  const stranger = await sendWebhook(webhookBody({ id: randomUUID(), transactionId: randomUUID(), amount: 10000, name: 'x' }));
  check('payment for an unknown order acknowledged and ignored', stranger.status === 200 && stranger.body?.reason === 'order_not_found');

  // ── Subscription ────────────────────────────────────────────────────────────
  const start = await api('/api/payments/start', {
    method: 'POST',
    token,
    body: JSON.stringify({ plan: 'kopi_susu', billingCycle: 'monthly', paymentMethod: 'qris' }),
  });
  const paymentId = start.body?.data?.paymentId;
  check('subscription: Mayar checkout created (redirectUrl retry path)', start.status === 201 && /myr\.id/.test(start.body?.data?.paymentUrl ?? ''), JSON.stringify(start.body));
  const subReference = psql(`select provider_reference from public.subscription_payment_sessions where id='${paymentId}'`);
  const subPayment = fake.payments.get(subReference);
  subPayment.status = 'paid';
  const subHook = await sendWebhook(webhookBody(subPayment));
  check('webhook activates the subscription', subHook.status === 200 && subHook.body?.kind === 'subscription', JSON.stringify(subHook.body));
  check('session linked to a subscription', Boolean(psql(`select coalesce(subscription_id::text,'') from public.subscription_payment_sessions where id='${paymentId}'`)));
  const manual = await api(`/api/payments/${paymentId}/check`, { method: 'POST', token, body: '{}' });
  check('manual "cek status" agrees and is idempotent', manual.status === 200 && manual.body?.status === 'paid');
  const userId = psql(`select id from public.profiles where email='${email}'`);
  const merchantOrderId = start.body?.data?.merchantOrderId;
  const paidSubscriptions = psql(`select count(*) from public.subscriptions where user_id='${userId}' and payment_ref='${merchantOrderId}'`);
  check('exactly one subscription for this payment', paidSubscriptions === '1', `count=${paidSubscriptions}`);
  check('Kopi Susu plan active', psql(`select plan from public.subscriptions where user_id='${userId}' and status='active' order by created_at desc limit 1`) === 'kopi_susu');

  // ── Connect script ──────────────────────────────────────────────────────────
  // Async spawn: the fake Mayar API lives in this process and must keep serving.
  const connect = await new Promise((resolve) => {
    const child = spawn('node', ['backend/scripts/mayar-connect.mjs', '--register', '--env-file=/dev/null'], {
      env: {
        PATH: process.env.PATH,
        MAYAR_ENVIRONMENT: 'sandbox',
        MAYAR_SANDBOX_BASE_URL: MAYAR_BASE,
        MAYAR_API_KEY: API_KEY,
        MAYAR_WEBHOOK_TOKEN: WEBHOOK_TOKEN,
        MAYAR_CALLBACK_URL: WEBHOOK_URL,
      },
    });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stdout += chunk; });
    child.on('close', (code) => resolve({ status: code, stdout }));
  });
  check('mayar:connect --register passes', connect.status === 0, connect.status === 0 ? '' : connect.stdout.slice(-800));
  check('connect output masks the secrets', !connect.stdout.includes(WEBHOOK_TOKEN) && !connect.stdout.includes(API_KEY));
  check('webhook URL registered without a token in it (header mode)', fake.webhookUrl === WEBHOOK_URL, String(fake.webhookUrl));

  await sleep(300);
  check('webhook token never appears in backend logs', !bootLog.includes(WEBHOOK_TOKEN));
  check('API key never appears in backend logs', !bootLog.includes(API_KEY));

  console.log(failures === 0 ? '\n🎉 MAYAR LOCAL SMOKE: ALL PASS' : `\n💥 MAYAR LOCAL SMOKE: ${failures} failure(s)`);
  process.exitCode = failures === 0 ? 0 : 1;
} catch (error) {
  console.error('SMOKE FAILED:', error.message);
  if (bootLog) console.error(bootLog.slice(-2000));
  process.exitCode = 1;
} finally {
  if (server) server.kill('SIGTERM');
  mayarServer.close();
  await sleep(500);
  try { psqlAdmin(`DROP DATABASE IF EXISTS ${DB_NAME}`); console.log('→ scratch database dropped'); } catch { /* best effort */ }
}
