/** Formatting helpers + option data for the loyalty tab. */
import type { LoyaltyRewardType } from '@/lib/loyalty';

export const fRp = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value || 0);

export const fNum = (value: number) => new Intl.NumberFormat('id-ID').format(value || 0);

export type Toast = { showToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void };

export const rewardTypeOptions: Array<{ id: LoyaltyRewardType; label: string }> = [
  { id: 'discount_amount', label: 'Diskon Nominal' },
  { id: 'discount_percent', label: 'Diskon Persen' },
  { id: 'free_item', label: 'Free Item' },
];

export function makeIdempotencyKey(prefix: string) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}:${crypto.randomUUID()}`;
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

