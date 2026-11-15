#!/usr/bin/env node
/**
 * Hubungkan KaffePOS ke Mayar (Headless API v2): cek API key, cek token webhook,
 * dan (opsional) daftarkan URL webhook ke akun Mayar.
 *
 * Jalankan di container backend (Coolify → backend → Terminal):
 *   node scripts/mayar-connect.mjs              # cek saja, tidak mengubah apa pun
 *   node scripts/mayar-connect.mjs --register   # daftarkan URL webhook ke Mayar + tes
 *
 * Atau dari laptop (membaca backend/.env bila ada):
 *   npm run mayar:connect -- --register
 *
 * MAYAR_WEBHOOK_TOKEN = "Web Token" dari dashboard Mayar. Mayar mengirimnya sendiri di header
 * X-Callback-Token, jadi URL webhook didaftarkan tanpa token.
 *
 * Opsi:
 *   --register       Ganti URL webhook di akun Mayar (POST /hl/v2/webhooks/update) lalu tes.
 *   --test           Minta Mayar mengirim webhook tes ke URL (POST /hl/v2/webhooks/test).
 *   --url-token      Tambahkan ?token=<MAYAR_WEBHOOK_TOKEN> ke URL yang didaftarkan
 *                    (untuk akun yang tidak punya Web Token; pakai token buatan sendiri).
 *   --skip-backend   Lewati pengecekan endpoint webhook KaffePOS.
 *   --env-file=PATH  Muat variabel dari file env tertentu.
 *
 * Secrets never leave this machine except to Mayar (API key) and to your own
 * backend (webhook token). Output masks both.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const envFileArg = process.argv.slice(2).find((arg) => arg.startsWith('--env-file='));

function loadEnvFile(file) {
  const full = path.resolve(process.cwd(), file);
  if (!fs.existsSync(full)) return false;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
  return true;
}

if (envFileArg) {
  if (!loadEnvFile(envFileArg.slice('--env-file='.length))) {
    console.error(`✗ File env tidak ditemukan: ${envFileArg.slice('--env-file='.length)}`);
    process.exit(2);
  }
} else {
  for (const candidate of ['.env', 'backend/.env', '.env.staging.local', 'backend/.env.staging.local']) {
    loadEnvFile(candidate);
  }
}

const PLACEHOLDER = /^(change-?me|__.*__|isi_.*|xxx+)$/i;
const read = (name) => (process.env[name] || '').trim();
const isSet = (value) => Boolean(value) && !PLACEHOLDER.test(value);
const mask = (value) => (value.length <= 10 ? '•'.repeat(value.length) : `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} karakter)`);

const environment = read('MAYAR_ENVIRONMENT') === 'production' ? 'production' : 'sandbox';
const baseUrl = (
  environment === 'production'
    ? read('MAYAR_PRODUCTION_BASE_URL') || 'https://api.mayar.id'
    : read('MAYAR_SANDBOX_BASE_URL') || 'https://api.mayar.io'
).replace(/\/+$/, '');
const apiKey = read('MAYAR_API_KEY');
const webhookToken = read('MAYAR_WEBHOOK_TOKEN');
const webhookPath = read('MAYAR_WEBHOOK_PATH') || '/api/webhooks/mayar';
const webhookUrl =
  read('MAYAR_CALLBACK_URL') ||
  `${(read('API_BASE_URL') || 'https://api.kaffepos.my.id').replace(/\/+$/, '')}${webhookPath.startsWith('/') ? webhookPath : `/${webhookPath}`}`;
const useUrlToken = args.has('--url-token');

let failures = 0;
const pass = (message) => console.log(`  ✓ ${message}`);
const warn = (message) => console.log(`  ! ${message}`);
const fail = (message) => {
  failures += 1;
  console.log(`  ✗ ${message}`);
};

async function call(method, url, { headers = {}, body } = {}) {
  try {
    const response = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON
    }
    return { status: response.status, ok: response.ok, json, text };
  } catch (error) {
    return { status: 0, ok: false, json: null, text: String(error?.message || error) };
  }
}

const mayarMessage = (res) => res.json?.messages || res.json?.message || res.text.slice(0, 200);
const mayar = (method, apiPath, body) =>
  call(method, `${baseUrl}${apiPath}`, { headers: { Authorization: `Bearer ${apiKey}` }, body });

function registeredHookUrl() {
  if (!useUrlToken) return webhookUrl;
  const url = new URL(webhookUrl);
  url.searchParams.set('token', webhookToken);
  return url.toString();
}

async function main() {
  console.log('── KaffePOS × Mayar ──');
  console.log(`Environment  : ${environment}`);
  console.log(`Mayar API    : ${baseUrl}/hl/v2`);
  console.log(`Webhook URL  : ${webhookUrl}${useUrlToken ? '?token=<MAYAR_WEBHOOK_TOKEN>' : ''}`);

  console.log('\n1. Konfigurasi');
  if (isSet(apiKey)) pass(`MAYAR_API_KEY terisi ${mask(apiKey)}`);
  else fail(`MAYAR_API_KEY belum diisi. Buat di ${environment === 'production' ? 'https://web.mayar.id/api-keys' : 'https://web.mayar.io/api-keys'}.`);
  if (isSet(webhookToken) && webhookToken.length >= 16) pass(`MAYAR_WEBHOOK_TOKEN terisi ${mask(webhookToken)}`);
  else if (isSet(webhookToken)) warn('MAYAR_WEBHOOK_TOKEN terlalu pendek. Pakai Web Token dari dashboard Mayar.');
  else fail('MAYAR_WEBHOOK_TOKEN belum diisi. Salin Web Token dari dashboard Mayar.');
  if (failures > 0) {
    console.log('\nLengkapi env di atas lalu jalankan lagi.');
    process.exit(2);
  }

  console.log('\n2. API key Mayar');
  const probe = await mayar('GET', '/hl/v2/payments?limit=1');
  if (probe.ok) pass(`API key diterima Mayar (${environment}).`);
  else if (probe.status === 401 || probe.status === 403)
    fail(`API key ditolak (${probe.status}). Pastikan key berasal dari dashboard ${environment} yang sama dengan MAYAR_ENVIRONMENT.`);
  else fail(`Mayar tidak bisa dihubungi (${probe.status || 'network'}): ${mayarMessage(probe)}`);

  if (!args.has('--skip-backend')) {
    console.log('\n3. Endpoint webhook KaffePOS');
    const health = await call('GET', webhookUrl);
    if (health.ok && health.json?.provider === 'mayar') {
      pass('Endpoint aktif.');
      if (health.json.webhookTokenConfigured === false) {
        fail('Backend belum punya MAYAR_WEBHOOK_TOKEN. Isi env di server lalu redeploy.');
      }
    } else {
      fail(`Endpoint tidak menjawab dengan benar (${health.status || 'network'}). Backend sudah di-deploy?`);
    }

    // A harmless, non-payment event: the backend must accept the token and ignore it.
    const ping = { event: 'kaffepos.connection_test', data: { note: 'mayar-connect self test' } };
    const withToken = await call('POST', webhookUrl, { headers: { 'X-Callback-Token': webhookToken }, body: ping });
    if (withToken.ok && withToken.json?.ignored) pass('Backend menerima token webhook yang sama dengan env ini.');
    else if (withToken.status === 401) fail('Backend menolak token: MAYAR_WEBHOOK_TOKEN di server berbeda dengan env ini.');
    else if (withToken.status === 503) fail('Backend belum punya MAYAR_WEBHOOK_TOKEN (503).');
    else fail(`Tes token ke backend gagal (${withToken.status || 'network'}): ${withToken.text.slice(0, 200)}`);

    const withoutToken = await call('POST', webhookUrl, { body: ping });
    if (withoutToken.status === 401) pass('Webhook tanpa token ditolak (401).');
    else fail(`Webhook tanpa token seharusnya ditolak, tapi dijawab ${withoutToken.status || 'network'}.`);
  }

  if (args.has('--register')) {
    console.log('\n4. Daftarkan URL webhook ke Mayar');
    const update = await mayar('POST', '/hl/v2/webhooks/update', { urlHook: registeredHookUrl() });
    if (update.ok) pass('URL webhook tersimpan di akun Mayar.');
    else fail(`Gagal menyimpan URL webhook (${update.status || 'network'}): ${mayarMessage(update)}`);
  }

  if (args.has('--register') || args.has('--test')) {
    console.log('\n5. Tes webhook dari Mayar');
    const test = await mayar('POST', '/hl/v2/webhooks/test', { urlHook: registeredHookUrl() });
    if (test.ok) {
      pass('Mayar berhasil mengirim webhook tes. Cek juga riwayat di Mayar → Integrasi → Webhook.');
    } else {
      fail(`Tes webhook gagal (${test.status || 'network'}): ${mayarMessage(test)}`);
      if (!useUrlToken) {
        console.log('    Kalau riwayat webhook Mayar menunjukkan 401, MAYAR_WEBHOOK_TOKEN belum sama dengan Web Token,');
        console.log('    atau akun ini tidak mengirim X-Callback-Token — jalankan ulang dengan --register --url-token.');
      }
    }
  } else {
    console.log('\nURL webhook belum diubah. Jalankan dengan --register untuk mendaftarkannya ke Mayar,');
    console.log('atau isi manual di Mayar → Integrasi → Webhook.');
  }

  console.log(failures === 0 ? '\n✓ Mayar terhubung.' : `\n✗ ${failures} pengecekan gagal.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('✗ Gagal:', error?.message || error);
  process.exit(1);
});
