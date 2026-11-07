// src/components/pos/posHelpers.ts — shared formatting, derived calculations,
// constants, and payment-phase helpers for the POS surface. Extracted from
// POSTab.tsx so the catalog grid, cart panel, and modals can share them.
import type { useModalBehavior } from '@/hooks/useModalBehavior';
import type { OrderType } from '@/types';

export const DEFAULT_FLOOR_TABLES = [
  { id: '01', label: 'Meja 01', zone: 'Indoor', capacity: 2 },
  { id: '02', label: 'Meja 02', zone: 'Indoor', capacity: 2 },
  { id: '03', label: 'Meja 03', zone: 'Indoor', capacity: 4 },
  { id: '04', label: 'Meja 04', zone: 'Indoor', capacity: 4 },
  { id: '05', label: 'Meja 05', zone: 'Indoor', capacity: 4 },
  { id: '06', label: 'Meja 06', zone: 'Indoor', capacity: 6 },
  { id: '07', label: 'Meja 07', zone: 'Indoor', capacity: 6 },
  { id: '08', label: 'Meja 08', zone: 'Indoor', capacity: 4 },
  { id: '09', label: 'Meja 09', zone: 'Outdoor', capacity: 2 },
  { id: '10', label: 'Meja 10', zone: 'Outdoor', capacity: 4 },
  { id: '11', label: 'Meja 11', zone: 'Outdoor', capacity: 4 },
  { id: '12', label: 'Meja 12', zone: 'Outdoor', capacity: 6 },
  { id: 'VIP-1', label: 'VIP 01', zone: 'VIP & Bar', capacity: 8 },
  { id: 'VIP-2', label: 'VIP 02', zone: 'VIP & Bar', capacity: 8 },
  { id: 'BAR-1', label: 'Bar 01', zone: 'VIP & Bar', capacity: 2 },
  { id: 'BAR-2', label: 'Bar 02', zone: 'VIP & Bar', capacity: 2 },
] as const;

export const ORDER_TYPE_META: Record<OrderType, { label: string; shortLabel: string; badgeClass: string }> = {
  dine_in: {
    label: 'Makan di Tempat (Dine-In)',
    shortLabel: 'Dine-In',
    badgeClass: 'bg-orange-50 text-[#FF6A00] border-orange-200',
  },
  takeaway: {
    label: 'Bungkus (Takeaway)',
    shortLabel: 'Takeaway',
    badgeClass: 'bg-stone-100 text-stone-700 border-stone-300',
  },
  gofood: {
    label: 'GoFood Delivery',
    shortLabel: 'GoFood',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  grabfood: {
    label: 'GrabFood Delivery',
    shortLabel: 'GrabFood',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
  },
  shopeefood: {
    label: 'ShopeeFood Delivery',
    shortLabel: 'ShopeeFood',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

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
