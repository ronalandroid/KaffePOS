import type { Request } from 'express';
import { getClientIp, isCloudflareIp } from './clientIp';

function request(ip: string | undefined, headers: Record<string, string> = {}) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ip,
    socket: { remoteAddress: ip },
    header: (name: string) => lower[name.toLowerCase()],
  } as unknown as Request;
}

describe('isCloudflareIp', () => {
  it.each([
    ['162.158.189.100', true],
    ['::ffff:172.68.10.5', true],
    ['2606:4700:10::6816:1', true],
    ['84.247.150.77', false],
    ['10.0.1.11', false],
    ['not-an-ip', false],
  ])('%s → %s', (ip, expected) => {
    expect(isCloudflareIp(ip)).toBe(expected);
  });
});

describe('getClientIp', () => {
  it('uses CF-Connecting-IP when the request came through Cloudflare', () => {
    expect(getClientIp(request('162.158.189.100', { 'CF-Connecting-IP': '36.71.140.22' }))).toBe('36.71.140.22');
  });

  it('ignores CF-Connecting-IP from a hop that is not Cloudflare (no spoofing via the origin)', () => {
    expect(getClientIp(request('84.247.150.77', { 'CF-Connecting-IP': '1.2.3.4' }))).toBe('84.247.150.77');
  });

  it('ignores X-Forwarded-For entirely; the visitor controls its first entry', () => {
    expect(getClientIp(request('162.158.189.100', { 'X-Forwarded-For': '1.2.3.4' }))).toBe('162.158.189.100');
  });

  it('falls back to the hop when the Cloudflare header is missing or invalid', () => {
    expect(getClientIp(request('162.158.189.100', { 'CF-Connecting-IP': 'garbage' }))).toBe('162.158.189.100');
  });

  it('unwraps IPv4-mapped IPv6 addresses for local requests', () => {
    expect(getClientIp(request('::ffff:127.0.0.1'))).toBe('127.0.0.1');
  });

  it('returns null when nothing usable is known', () => {
    expect(getClientIp(request(undefined))).toBeNull();
  });
});
