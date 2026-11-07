#!/usr/bin/env node
/**
 * End-to-end live smoke verification against the InsForge Cloud Backend
 * (InsForge PostgreSQL + InsForge Edge Function + KaffePOS Backend API).
 *
 * Usage: npm run smoke:insforge
 *
 * Cleans up its temporary test user (`smoke-insforge-*@test.local`) on exit so
 * the production/cloud database remains clean.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@insforge/sdk';
import pg from '../backend/node_modules/pg/lib/index.js';

const { Pool } = pg;

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    out[key] = val;
  }
  return out;
}

const backendEnv = loadEnvFile(resolve(process.cwd(), 'backend/.env'));
const rootEnv = loadEnvFile(resolve(process.cwd(), '.env.local'));

const rawDatabaseUrl = process.env.DATABASE_URL || backendEnv.DATABASE_URL;
const insforgeUrl =
  process.env.INSFORGE_URL ||
  backendEnv.INSFORGE_URL ||
  rootEnv.VITE_INSFORGE_URL ||
  'https://6x4q2bgn.ap-southeast.insforge.app';
const insforgeAnonKey =
  process.env.INSFORGE_ANON_KEY ||
  backendEnv.INSFORGE_ANON_KEY ||
  rootEnv.VITE_INSFORGE_ANON_KEY ||
  '';

if (!rawDatabaseUrl) {
  console.error('Missing DATABASE_URL in environment or backend/.env');
  process.exit(2);
}

function stripSslMode(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('sslmode');
    return u.toString();
  } catch {
    return url;
  }
}

const pool = new Pool({
  connectionString: stripSslMode(rawDatabaseUrl),
  ssl: { rejectUnauthorized: true },
});

const PORT = Number(process.env.SMOKE_INSFORGE_PORT || 8917);
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server = null;
let failures = 0;
let createdEmail = null;

function check(label, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function api(path, { token, ...opts } = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const text = await r.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: r.status, body };
}

try {
  // 1. InsForge Edge Function check via @insforge/sdk
  if (insforgeAnonKey) {
    const insforge = createClient({ baseUrl: insforgeUrl, anonKey: insforgeAnonKey });
    const { data: edgeStatus, error: edgeError } = await insforge.functions.invoke('kaffepos-status', {
      method: 'GET',
    });
    check(
      'InsForge Edge Function (kaffepos-status) via @insforge/sdk',
      !edgeError && edgeStatus?.ok === true && edgeStatus?.provider === 'insforge',
      edgeError ? edgeError.message : `region=${edgeStatus?.region} version=${edgeStatus?.appVersion?.version}`,
    );
  }

  // 2. Boot KaffePOS backend connected to InsForge Postgres
  console.log('→ booting KaffePOS backend against InsForge PostgreSQL...');
  server = spawn('node', ['dist/index.js'], {
    cwd: 'backend',
    env: {
      ...process.env,
      ...backendEnv,
      DATABASE_URL: rawDatabaseUrl,
      DB_SSL: 'true',
      DB_SSL_REJECT_UNAUTHORIZED: 'true',
      NODE_ENV: 'development',
      PORT: String(PORT),
      PAYMENT_INTEGRATION_ENABLED: 'false',
      CORS_ORIGIN: 'http://localhost:5173',
      WEB_BASE_URL: 'http://localhost:5173',
      API_BASE_URL: BASE,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let bootLog = '';
  server.stdout.on('data', (d) => {
    bootLog += d;
  });
  server.stderr.on('data', (d) => {
    bootLog += d;
  });

  let healthRes = null;
  for (let i = 0; i < 50; i++) {
    try {
      const r = await api('/health');
      if (r.status === 200 && r.body?.ok) {
        healthRes = r.body;
        break;
      }
    } catch {
      // waiting for server
    }
    await sleep(300);
  }

  check(
    'Backend boots & /health reports provider=insforge',
    Boolean(healthRes?.ok && healthRes?.checks?.database?.provider === 'insforge'),
    `provider=${healthRes?.checks?.database?.provider} latencyMs=${healthRes?.checks?.database?.latencyMs}`,
  );
  if (!healthRes) {
    console.error(bootLog.slice(-2000));
    throw new Error('Backend failed to boot against InsForge PostgreSQL');
  }

  // 3. System Status check
  const sysStatus = await api('/system-status');
  check(
    '/system-status syncMatrix is healthy on InsForge',
    sysStatus.status === 200 &&
      sysStatus.body?.ok === true &&
      sysStatus.body?.checks?.database?.provider === 'insforge' &&
      sysStatus.body?.syncMatrix?.stores === true &&
      sysStatus.body?.syncMatrix?.transactions === true,
  );

  // 4. End-to-End Auth + Store + Inventory + POS Transaction Sync
  const suffix = Date.now().toString(36);
  createdEmail = `smoke-insforge-${suffix}@test.local`;
  const password = 'SmokeInsforge123!';

  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: createdEmail,
      password,
      username: `smokeinsf_${suffix}`,
      display_name: 'Smoke InsForge',
      store_name: 'InsForge Kopi Outlet',
    }),
  });
  check('POST /api/auth/register', reg.status === 200 || reg.status === 201, `status=${reg.status}`);

  const codeRow = await pool.query(
    'select code from public.email_verification_codes where email = $1 order by created_at desc limit 1',
    [createdEmail],
  );
  const code = codeRow.rows[0]?.code;
  const confirm = await api('/api/auth/verification/confirm', {
    method: 'POST',
    body: JSON.stringify({ email: createdEmail, code }),
  });
  check('POST /api/auth/verification/confirm', confirm.status === 200, `status=${confirm.status}`);

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: createdEmail, password }),
  });
  const token = login.body?.accessToken;
  check('POST /api/auth/login returns accessToken', Boolean(token), `status=${login.status}`);

  const stores = await api('/api/stores', { token });
  const storeId = stores.body?.items?.[0]?.id;
  check('GET /api/stores returns auto-created store', Boolean(storeId), `storeId=${storeId}`);

  const imp = await api('/api/inventory/bulk-import/commit', {
    method: 'POST',
    token,
    body: JSON.stringify({
      store_id: storeId,
      mode: 'create_only',
      rows: [
        {
          rowNumber: 1,
          kind: 'ingredient',
          name: 'Biji Arabika InsForge',
          stock: 1000,
          base_unit: 'gram',
          purchase_unit: 'kg',
          min_stock: 100,
          total_cost: 250000,
        },
        {
          rowNumber: 2,
          kind: 'product',
          name: 'Es Kopi InsForge',
          price: 22000,
          category: 'Signature',
        },
        {
          rowNumber: 3,
          kind: 'recipe',
          product_name: 'Es Kopi InsForge',
          ingredient_name: 'Biji Arabika InsForge',
          qty_per_serving: 18,
          unit_reference: 'gram',
        },
      ],
    }),
  });
  const committed = imp.body?.committed;
  check(
    'POST /api/inventory/bulk-import/commit',
    imp.status === 201 &&
      committed?.ingredients === 1 &&
      committed?.products === 1 &&
      committed?.recipes === 1,
    `status=${imp.status}`,
  );

  console.log(
    failures === 0
      ? '\n🎉 INSFORGE BACKEND SMOKE: ALL CHECKS PASSED'
      : `\n💥 INSFORGE BACKEND SMOKE: ${failures} FAILURE(S)`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
} catch (error) {
  console.error('INSFORGE SMOKE FAILED:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (server) {
    server.kill('SIGTERM');
    await sleep(400);
  }
  if (createdEmail) {
    try {
      await pool.query('delete from public.email_verification_codes where email = $1', [createdEmail]);
      await pool.query('delete from public.auth_account_lockouts where email = $1', [createdEmail]);
      await pool.query('delete from public.profiles where lower(email) = lower($1)', [createdEmail]);
      console.log('→ cleaned up temporary smoke test records from InsForge PostgreSQL');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr));
    }
  }
  await pool.end().catch(() => {});
}
