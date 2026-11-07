#!/usr/bin/env node
/**
 * Mayar Headless API v2 sandbox/production smoke test.
 *
 * Reads MAYAR_* credentials from the environment (or .env.staging.local / backend/.env)
 * and creates a single payment request via POST /hl/v2/payments/create.
 *
 * Usage:
 *   MAYAR_API_KEY=... MAYAR_ENVIRONMENT=sandbox npm run smoke:staging:mayar
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

for (const candidate of ['.env.staging.local', 'backend/.env.staging.local', 'backend/.env', '.env']) {
  const full = path.resolve(process.cwd(), candidate);
  if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

function requireEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value || value === 'change-me' || value.startsWith('ISI_')) {
    console.error(`✗ ${name} wajib diisi untuk smoke test Mayar (set di env atau backend/.env).`);
    process.exit(2);
  }
  return value;
}

const apiKey = requireEnv('MAYAR_API_KEY');
const environment = process.env.MAYAR_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
const baseUrl = (
  environment === 'production'
    ? process.env.MAYAR_PRODUCTION_BASE_URL || 'https://api.mayar.id'
    : process.env.MAYAR_SANDBOX_BASE_URL || 'https://api.mayar.club'
).replace(/\/$/, '');
const createPath = process.env.MAYAR_CREATE_PAYMENT_PATH || '/hl/v2/payments/create';
const dueMinutes = Number(process.env.MAYAR_PAYMENT_DUE_MINUTES || 60);
const amount = Number(process.env.MAYAR_SMOKE_AMOUNT || 10000);

async function main() {
  const orderId = `SMOKE-MAYAR-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const expiredAt = new Date(Date.now() + dueMinutes * 60_000).toISOString();
  const payload = {
    name: 'KaffePOS Mayar Smoke Test',
    amount,
    email: 'smoke@kaffepos.my.id',
    mobile: '081234567890',
    description: `KaffePOS smoke test [${orderId}]`,
    expiredAt,
    extraData: {
      merchantOrderId: orderId,
      orderId,
    },
  };

  console.log('── Mayar Headless API v2 smoke test ──');
  console.log('Environment   :', environment);
  console.log('Endpoint      :', `${baseUrl}${createPath}`);
  console.log('Order ID      :', orderId);
  console.log('Amount (IDR)  :', amount);

  const response = await fetch(`${baseUrl}${createPath}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    // non-json response
  }

  console.log('\n── Response ──');
  console.log('HTTP status   :', response.status);
  const data = json?.data ?? {};
  const paymentUrl = data?.link ?? data?.linkPayment ?? data?.paymentUrl ?? null;

  if (response.ok && paymentUrl) {
    console.log('\n✓ PASS — Mayar mengembalikan payment link:');
    console.log('  id          :', data.id);
    console.log('  link        :', paymentUrl);
    process.exit(0);
  } else {
    console.error('\n✗ FAIL — Mayar tidak mengembalikan payment link.');
    console.error('Raw body      :', text.slice(0, 1500));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('✗ Request gagal:', err?.message || err);
  process.exit(1);
});
