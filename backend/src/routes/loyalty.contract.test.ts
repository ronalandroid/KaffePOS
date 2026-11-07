import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const routeSource = readFileSync(join(process.cwd(), 'backend/src/routes/loyalty.ts'), 'utf8');
const bootstrapSource = readFileSync(join(process.cwd(), 'backend/src/schema-bootstrap.ts'), 'utf8');

describe('Kopi Passport loyalty contract', () => {
  it('exposes the requested public loyalty endpoints', () => {
    expect(routeSource).toContain("router.get('/api/loyalty/customers'");
    expect(routeSource).toContain("router.post('/api/loyalty/stamp'");
    expect(routeSource).toContain("router.post('/api/loyalty/redeem'");
    expect(routeSource).toContain("router.get('/api/loyalty/settings'");
    expect(routeSource).toContain("router.put('/api/loyalty/settings'");
  });

  it('bootstraps the requested loyalty tables', () => {
    expect(bootstrapSource).toContain('create table if not exists public.loyalty_customers');
    expect(bootstrapSource).toContain('create table if not exists public.loyalty_stamps');
    expect(bootstrapSource).toContain('create table if not exists public.loyalty_rewards');
    expect(bootstrapSource).toContain('create table if not exists public.loyalty_tiers');
  });

  it('lists customers without an N+1 write loop (derives in-memory, no per-row upsert)', () => {
    // Isolate the GET /api/loyalty/customers handler body.
    const start = routeSource.indexOf("router.get('/api/loyalty/customers'");
    const next = routeSource.indexOf('router.', start + 1);
    const handler = routeSource.slice(start, next === -1 ? undefined : next);

    // It must not re-upsert per passport row (that was the N+1 + a write inside a GET).
    expect(handler).not.toContain('upsertCustomerFromPassport');
    // It must derive the response in-memory from the single passports query.
    expect(handler).toMatch(/passports\.rows\.map\(/);
  });
});
