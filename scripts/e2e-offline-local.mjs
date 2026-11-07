#!/usr/bin/env node
/**
 * Offline-access E2E orchestrator (npm run test:e2e:offline):
 * fresh scratch Postgres -> backend dist -> PRODUCTION frontend build with the
 * local API URL baked in -> `vite preview` (service worker active) -> seeded
 * verified account -> playwright e2e/local-offline.spec.ts -> teardown.
 *
 * Requires local Postgres. Never touches existing databases.
 */
import { spawn, execSync } from 'node:child_process';

const DB_NAME = 'kaffepos_e2e_offline';
const API_PORT = 8912;
const WEB_PORT = 4183;
const PG = process.env.SMOKE_PG_URL_BASE || 'postgresql://macbook@localhost:5432';
const DB = `${PG}/${DB_NAME}`;
const API = `http://localhost:${API_PORT}`;
const WEB = `http://localhost:${WEB_PORT}`;
const EMAIL = 'e2e-local@test.local';
const PASSWORD = 'E2eLocal123!';

const sh = (cmd, opts = {}) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
const psqlAdmin = (sql) => sh(`psql "${PG}/postgres" -tA -c ${JSON.stringify(sql)}`);
const psql = (sql) => sh(`psql "${DB}" -tA -c ${JSON.stringify(sql)}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return true; } catch { /* booting */ }
    await sleep(400);
  }
  return false;
}

let backend = null;
let web = null;
let exitCode = 1;

try {
  try { sh('pg_isready'); } catch {
    console.error('Local Postgres is not running. Aborting.');
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

  console.log('→ booting backend dist');
  backend = spawn('node', ['dist/index.js'], {
    cwd: 'backend',
    env: {
      ...process.env,
      DATABASE_URL: DB, NODE_ENV: 'development', PORT: String(API_PORT),
      PAYMENT_INTEGRATION_ENABLED: 'false', EMAIL_INTEGRATION_ENABLED: 'false',
      R2_STORAGE_ENABLED: 'false', ANALYTICS_SERVER_ENABLED: 'false',
      JWT_SECRET: 'e2e-offline-secret', SESSION_SECRET: 'e2e-offline-session',
      ENCRYPTION_KEY: 'e2e-offline-key-32-bytes-pad!!!!',
      CORS_ORIGIN: WEB, WEB_BASE_URL: WEB, API_BASE_URL: API,
    },
    stdio: 'ignore',
  });
  if (!(await waitFor(`${API}/health`))) throw new Error('backend never became healthy');

  console.log('→ seeding verified test account');
  const post = async (path, body) => fetch(`${API}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  await post('/api/auth/register', { email: EMAIL, password: PASSWORD, username: 'e2eoffline', display_name: 'E2E Offline', store_name: 'Offline Store' });
  const code = psql(`select code from public.email_verification_codes where email='${EMAIL}' order by created_at desc limit 1`);
  await post('/api/auth/verification/confirm', { email: EMAIL, code });

  console.log('→ building PRODUCTION frontend (API URL baked in, service worker active)');
  execSync('npx vite build', {
    env: { ...process.env, VITE_API_BASE_URL: API },
    stdio: 'pipe',
  });

  console.log('→ starting vite preview');
  web = spawn('npx', ['vite', 'preview', '--port', String(WEB_PORT), '--strictPort'], {
    env: { ...process.env },
    stdio: 'ignore',
  });
  if (!(await waitFor(WEB))) throw new Error('vite preview never became ready');

  console.log('→ running offline playwright spec');
  try {
    execSync('npx playwright test e2e/local-offline.spec.ts --config e2e/playwright.local.config.ts', {
      env: { ...process.env, E2E_WEB_URL: WEB, E2E_EMAIL: EMAIL, E2E_PASSWORD: PASSWORD },
      stdio: 'inherit',
    });
    exitCode = 0;
  } catch {
    exitCode = 1;
  }
} catch (e) {
  console.error('OFFLINE E2E ORCHESTRATION FAILED:', e.message);
  exitCode = 1;
} finally {
  if (web) web.kill('SIGTERM');
  if (backend) backend.kill('SIGTERM');
  await sleep(600);
  try { psqlAdmin(`DROP DATABASE IF EXISTS ${DB_NAME}`); console.log('→ scratch database dropped'); } catch { /* best effort */ }
}
process.exit(exitCode);
