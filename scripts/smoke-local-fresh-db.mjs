#!/usr/bin/env node
/**
 * Local fresh-database smoke: proves the whole stack can be provisioned and run
 * from the repo alone, catching schema drift between base-schema.sql,
 * schema-bootstrap.ts, migrations, and the code (this exact drift shipped twice:
 * missing base tables, and notifications.read vs is_read).
 *
 * Requires a LOCAL Postgres (brew services start postgresql@14). Creates and
 * drops its own scratch database; never touches existing databases.
 *
 * Usage: npm run smoke:local:fresh-db
 *
 * Steps: create scratch DB -> base-schema.sql -> bootstrapAllSchemas -> all
 * migrations -> boot backend dist -> health -> register -> email-verify (code
 * read from scratch DB) -> login -> session -> stores -> small bulk-import ->
 * assertions -> cleanup.
 */
import { spawn, execSync } from 'node:child_process';

const DB_NAME = 'kaffepos_smoke_localfresh';
const PORT = Number(process.env.SMOKE_PORT || 8907);
const PG = process.env.SMOKE_PG_URL_BASE || 'postgresql://macbook@localhost:5432';
const DB = `${PG}/${DB_NAME}`;
const BASE = `http://localhost:${PORT}`;

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const psqlAdmin = (sql) => sh(`psql "${PG}/postgres" -tA -c ${JSON.stringify(sql)}`);
const psql = (sql) => sh(`psql "${DB}" -tA -c ${JSON.stringify(sql)}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server = null;
let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

async function api(path, { token, ...opts } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  let body;
  const text = await r.text();
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

try {
  // Preflight
  try { sh('pg_isready'); } catch {
    console.error('Local Postgres is not running (brew services start postgresql@14). Aborting.');
    process.exit(2);
  }

  console.log(`→ provisioning scratch database ${DB_NAME}`);
  psqlAdmin(`DROP DATABASE IF EXISTS ${DB_NAME}`);
  psqlAdmin(`CREATE DATABASE ${DB_NAME}`);
  sh(`psql "${DB}" -v ON_ERROR_STOP=1 -f database/base-schema.sql`);
  check('base-schema.sql applied', true);

  execSync(
    `node -e "const{bootstrapAllSchemas}=require('./dist/schema-bootstrap.js');const{pool}=require('./dist/core/db.js');bootstrapAllSchemas().then(async()=>{await pool.end();}).catch(async(e)=>{console.error(e.message);await pool.end();process.exit(1);})"`,
    { cwd: 'backend', env: { ...process.env, DATABASE_URL: DB, NODE_ENV: 'development' }, stdio: 'inherit' },
  );
  check('bootstrapAllSchemas applied', true);

  execSync('npm --prefix backend run migrate', {
    env: { ...process.env, DATABASE_URL: DB }, stdio: 'pipe',
  });
  check('all migrations applied', true);

  console.log('→ booting backend dist');
  server = spawn('node', ['dist/index.js'], {
    cwd: 'backend',
    env: {
      ...process.env,
      DATABASE_URL: DB, NODE_ENV: 'development', PORT: String(PORT),
      PAYMENT_INTEGRATION_ENABLED: 'false', EMAIL_INTEGRATION_ENABLED: 'false',
      R2_STORAGE_ENABLED: 'false', ANALYTICS_SERVER_ENABLED: 'false',
      JWT_SECRET: 'smoke-local-secret', SESSION_SECRET: 'smoke-local-session',
      ENCRYPTION_KEY: 'smoke-local-key-32-bytes-padding',
      CORS_ORIGIN: 'http://localhost:5173', WEB_BASE_URL: 'http://localhost:5173', API_BASE_URL: BASE,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let bootLog = '';
  server.stdout.on('data', (d) => { bootLog += d; });
  server.stderr.on('data', (d) => { bootLog += d; });

  let healthy = false;
  for (let i = 0; i < 40 && !healthy; i++) {
    try { healthy = (await fetch(`${BASE}/health`)).ok; } catch { /* booting */ }
    if (!healthy) await sleep(300);
  }
  check('server boots and /health is ok', healthy);
  if (!healthy) { console.error(bootLog.slice(-1500)); throw new Error('boot failed'); }

  // Auth flow
  const email = 'smoke-fresh@test.local';
  const password = 'SmokeFresh123!';
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, username: 'smokefresh', display_name: 'Smoke Fresh', store_name: 'Smoke Store' }),
  });
  check('register', reg.status === 200 || reg.status === 201, `status=${reg.status}`);

  const code = psql(`select code from public.email_verification_codes where email='${email}' order by created_at desc limit 1`);
  const confirm = await api('/api/auth/verification/confirm', { method: 'POST', body: JSON.stringify({ email, code }) });
  check('email verification confirm', confirm.status === 200, `status=${confirm.status}`);

  const login = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const token = login.body?.accessToken;
  check('login returns accessToken', Boolean(token), `status=${login.status}`);

  const session = await api('/api/auth/session', { token });
  check('authenticated session', session.status === 200 && Boolean(session.body?.user?.id));

  const stores = await api('/api/stores', { token });
  const storeId = stores.body?.items?.[0]?.id;
  check('store auto-created and listed', Boolean(storeId));

  // Small bulk import exercising the batched write path
  const rows = [];
  let rn = 1;
  for (let i = 1; i <= 10; i++) rows.push({ rowNumber: rn++, kind: 'ingredient', name: `Smoke Bahan ${i}`, stock: 10 * i, base_unit: 'gram', purchase_unit: 'kg', min_stock: 5, total_cost: 10000 * i });
  for (let i = 1; i <= 5; i++) rows.push({ rowNumber: rn++, kind: 'product', name: `Smoke Produk ${i}`, price: 15000, category: 'Coffee' });
  rows.push({ rowNumber: rn++, kind: 'recipe', product_name: 'Smoke Produk 1', ingredient_name: 'Smoke Bahan 1', qty_per_serving: 3, unit_reference: 'gram' });

  const imp = await api('/api/inventory/bulk-import/commit', {
    method: 'POST', token,
    body: JSON.stringify({ store_id: storeId, mode: 'create_only', rows }),
  });
  const committed = imp.body?.committed;
  check(
    'bulk-import commit (batched path)',
    imp.status === 201 && committed?.ingredients === 10 && committed?.products === 5 && committed?.recipes === 1,
    `status=${imp.status} committed=${JSON.stringify(committed)}`,
  );

  const invCount = Number(psql('select count(*) from public.inventory'));
  const recipeLen = Number(psql(`select jsonb_array_length(recipe) from public.menu_items where name='Smoke Produk 1'`));
  check('inventory rows persisted', invCount === 10, `count=${invCount}`);
  check('recipe persisted on product', recipeLen === 1, `len=${recipeLen}`);

  console.log(failures === 0 ? '\n🎉 FRESH-DB SMOKE: ALL PASS' : `\n💥 FRESH-DB SMOKE: ${failures} failure(s)`);
  process.exitCode = failures === 0 ? 0 : 1;
} catch (e) {
  console.error('SMOKE FAILED:', e.message);
  process.exitCode = 1;
} finally {
  if (server) server.kill('SIGTERM');
  await sleep(500);
  try { psqlAdmin(`DROP DATABASE IF EXISTS ${DB_NAME}`); console.log('→ scratch database dropped'); } catch { /* best effort */ }
}
