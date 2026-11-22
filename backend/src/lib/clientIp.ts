import { BlockList, isIP } from 'node:net';
import type { Request } from 'express';

// Production traffic reaches the app as visitor → Cloudflare → Coolify proxy → app. With
// `trust proxy` = 1, req.ip is the Cloudflare edge address, which rotates per request and is shared
// by unrelated visitors, so it is useless for rate limits and audit trails. Cloudflare puts the
// visitor's address in CF-Connecting-IP; trust that header only when the hop that sent it really is
// Cloudflare, otherwise anyone calling the origin directly could choose their own IP.
//
// Ranges from https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6.
const CLOUDFLARE_IPV4 = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18',
  '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17',
  '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
];
const CLOUDFLARE_IPV6 = [
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32',
  '2a06:98c0::/29', '2c0f:f248::/32',
];

const cloudflare = new BlockList();
for (const range of CLOUDFLARE_IPV4) {
  const [address, prefix] = range.split('/');
  cloudflare.addSubnet(address, Number(prefix), 'ipv4');
}
for (const range of CLOUDFLARE_IPV6) {
  const [address, prefix] = range.split('/');
  cloudflare.addSubnet(address, Number(prefix), 'ipv6');
}

function normalizeIp(value: string | undefined | null) {
  const trimmed = value?.trim() ?? '';
  // IPv4 clients on a dual-stack socket appear as ::ffff:1.2.3.4.
  const unmapped = trimmed.startsWith('::ffff:') && isIP(trimmed.slice(7)) === 4 ? trimmed.slice(7) : trimmed;
  return isIP(unmapped) ? unmapped : null;
}

export function isCloudflareIp(value: string | undefined | null) {
  const ip = normalizeIp(value);
  if (!ip) return false;
  return cloudflare.check(ip, isIP(ip) === 6 ? 'ipv6' : 'ipv4');
}

/** The visitor's IP address, or null when it cannot be determined. */
export function getClientIp(req: Request): string | null {
  const hop = normalizeIp(req.ip ?? req.socket?.remoteAddress);
  if (hop && isCloudflareIp(hop)) {
    const visitor = normalizeIp(req.header('cf-connecting-ip'));
    if (visitor) return visitor;
  }
  return hop;
}
