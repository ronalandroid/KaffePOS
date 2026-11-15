import { describe, expect, it } from 'vitest';
import { redactUrlSecrets } from './redactUrl';

describe('redactUrlSecrets', () => {
  it('hides the Mayar webhook token in logged URLs', () => {
    expect(redactUrlSecrets('/api/webhooks/mayar?token=abc123')).toBe('/api/webhooks/mayar?token=[redacted]');
    expect(redactUrlSecrets('/api/webhooks/mayar?foo=1&token=abc123&bar=2')).toBe('/api/webhooks/mayar?foo=1&token=[redacted]&bar=2');
    expect(redactUrlSecrets('/x?TOKEN=abc&api_key=k')).toBe('/x?TOKEN=[redacted]&api_key=[redacted]');
  });

  it('leaves URLs without secrets untouched', () => {
    expect(redactUrlSecrets('/api/payments/start?plan=signature')).toBe('/api/payments/start?plan=signature');
    expect(redactUrlSecrets('/api/tokenizer?mytoken=1')).toBe('/api/tokenizer?mytoken=1');
    expect(redactUrlSecrets(undefined)).toBe('');
  });
});
