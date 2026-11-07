// src/components/pos/posHelpers.ts — shared formatting, derived calculations,
// constants, and payment-phase helpers for the POS surface. Extracted from
// POSTab.tsx so the catalog grid, cart panel, and modals can share them.
import type { useModalBehavior } from '@/hooks/useModalBehavior';

const IDR_FORMATTER = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });

export const SKELETON_KEYS = Array.from({ length: 8 }, (_, index) => `pos-skeleton-${index + 1}`);

export const PROMOS = [
  { l: 'Diskon 10%', v: '10%', d: 'Potongan 10% dari subtotal' },
  { l: 'Diskon 50%', v: '50%', d: 'Potongan setengah harga' },
  { l: 'Potongan 5rb', v: '5000', d: 'Potongan flat Rp 5.000' },
  { l: 'Potongan 10rb', v: '10000', d: 'Potongan flat Rp 10.000' },
  { l: 'Jumat Berkah (20%)', v: '20%', d: 'Promo khusus hari Jumat' },
  { l: 'Batal Diskon', v: '', d: 'Hapus semua potongan' },
] as const;

export const fRp = (n: number) => IDR_FORMATTER.format(n || 0);

// ── Quick amount buttons ──────────────────────────────────────────
export function quickAmounts(total: number): number[] {
  const rounded = Math.ceil(total / 10_000) * 10_000;
  return [...new Set([total, rounded, 50_000, 100_000].filter(v => v >= total))];
}

export function makeIdempotencyKey(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}:${crypto.randomUUID()}`;
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

export type PaymentPhase = 'idle' | 'creating' | 'snap_open' | 'pending' | 'success' | 'failed' | 'cancelled' | 'expired' | 'denied';

export function getPaymentMessage(phase: PaymentPhase): string | null {
  if (phase === 'creating') return 'Membuat pembayaran aman...';
  if (phase === 'snap_open') return 'Halaman pembayaran siap. Selesaikan pembayaran di tab baru.';
  if (phase === 'pending') return 'Pembayaran sedang menunggu konfirmasi gateway.';
  if (phase === 'success') return 'Pembayaran berhasil. Struk digital siap.';
  if (phase === 'cancelled') return 'Pembayaran dibatalkan. Pesanan belum diproses.';
  if (phase === 'expired') return 'Waktu pembayaran habis. Silakan buat pembayaran baru.';
  if (phase === 'denied') return 'Pembayaran ditolak. Silakan coba metode lain.';
  if (phase === 'failed') return 'Pembayaran gagal, silakan coba lagi.';
  return null;
}

// Shared return shape of useModalBehavior for the POS dialog panels, so the
// modal subcomponents can accept the parent-owned behavior object as a prop.
export type PosModalBehavior = ReturnType<typeof useModalBehavior<HTMLDivElement>>;
