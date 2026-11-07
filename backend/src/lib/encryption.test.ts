import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mutable mock env so individual tests can flip NODE_ENV / PII_ENCRYPTION_KEY.
const { mockEnv } = vi.hoisted(() => ({
  mockEnv: { NODE_ENV: 'test' as string, PII_ENCRYPTION_KEY: 'unit-test-pii-key-abc123' as string | undefined },
}));

vi.mock('../core/env', () => ({ env: mockEnv }));

import {
  encryptPii,
  decryptPii,
  maskPii,
  hashPii,
  encryptBankAccountNumber,
  decryptBankAccountNumber,
} from './encryption';

describe('encryption (PII)', () => {
  beforeEach(() => {
    mockEnv.NODE_ENV = 'test';
    mockEnv.PII_ENCRYPTION_KEY = 'unit-test-pii-key-abc123';
  });

  describe('encryptPii / decryptPii roundtrip', () => {
    it('decrypts back to the original plaintext', () => {
      const plain = 'BCA 1234567890 a.n. Budi';
      const encrypted = encryptPii(plain);
      expect(encrypted).not.toBe(plain);
      expect(decryptPii(encrypted)).toBe(plain);
    });

    it('produces different ciphertext each call (random IV) but both decrypt correctly', () => {
      const plain = '081234567890';
      const a = encryptPii(plain);
      const b = encryptPii(plain);
      expect(a).not.toBe(b);
      expect(decryptPii(a)).toBe(plain);
      expect(decryptPii(b)).toBe(plain);
    });

    it('handles unicode and long values', () => {
      const plain = 'Café Señor — 日本語 — ' + 'x'.repeat(500);
      expect(decryptPii(encryptPii(plain))).toBe(plain);
    });

    it('passes empty string through without encrypting', () => {
      expect(encryptPii('')).toBe('');
      expect(decryptPii('')).toBe('');
    });
  });

  describe('decryptPii resilience', () => {
    it('returns the input unchanged for non-encrypted / legacy plaintext (backward compatible)', () => {
      const legacy = 'plain-account-not-encrypted';
      expect(decryptPii(legacy)).toBe(legacy);
    });

    it('does not throw and returns input when ciphertext is tampered (auth tag mismatch)', () => {
      const encrypted = encryptPii('sensitive');
      const tampered = encrypted.slice(0, -4) + (encrypted.slice(-4) === 'AAAA' ? 'BBBB' : 'AAAA');
      expect(() => decryptPii(tampered)).not.toThrow();
    });
  });

  describe('key derivation guards', () => {
    it('throws in production when PII_ENCRYPTION_KEY is missing', () => {
      mockEnv.NODE_ENV = 'production';
      mockEnv.PII_ENCRYPTION_KEY = undefined;
      expect(() => encryptPii('x')).toThrow(/PII_ENCRYPTION_KEY/);
    });

    it('falls back to a dev key (no throw) outside production when key is missing', () => {
      mockEnv.NODE_ENV = 'development';
      mockEnv.PII_ENCRYPTION_KEY = undefined;
      const out = encryptPii('x');
      expect(out).toBeTruthy();
      expect(decryptPii(out)).toBe('x');
    });

    it('does not derive the key from a DB password (rotating DB creds must not break decryption)', () => {
      // Encrypt with the real key, then ensure a different secret cannot decrypt it.
      mockEnv.PII_ENCRYPTION_KEY = 'the-real-pii-key';
      const encrypted = encryptPii('rekening-rahasia');
      mockEnv.PII_ENCRYPTION_KEY = 'postgres://user:pass@host/db'; // a DB URL must NOT decrypt
      // wrong key -> auth tag fails -> resilient fallback returns the ciphertext, never the plaintext
      expect(decryptPii(encrypted)).not.toBe('rekening-rahasia');
    });
  });

  describe('maskPii', () => {
    it('masks all but the last N visible characters', () => {
      expect(maskPii('1234567890', 4)).toBe('******7890');
    });
    it('fully masks values at or below the visible length', () => {
      expect(maskPii('123', 4)).toBe('***');
    });
    it('returns null for empty / nullish input', () => {
      expect(maskPii(null)).toBeNull();
      expect(maskPii(undefined)).toBeNull();
      expect(maskPii('')).toBeNull();
    });
  });

  describe('hashPii', () => {
    it('is deterministic and returns a 64-char sha256 hex', () => {
      const h1 = hashPii('budi@example.com');
      const h2 = hashPii('budi@example.com');
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[0-9a-f]{64}$/);
    });
    it('differs for different inputs', () => {
      expect(hashPii('a')).not.toBe(hashPii('b'));
    });
  });

  describe('bank-account aliases', () => {
    it('encryptBankAccountNumber / decryptBankAccountNumber roundtrip', () => {
      const acct = '8810' + '0'.repeat(6);
      expect(decryptBankAccountNumber(encryptBankAccountNumber(acct))).toBe(acct);
    });
  });
});
