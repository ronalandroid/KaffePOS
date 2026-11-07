/** Loyalty (Kopi Passport) endpoint catalog. */
import { apiFetch, type ApiListResponse } from './client';
import type {
  LoyaltyOverview,
  LoyaltyCustomer,
  LoyaltyPassport,
  LoyaltyRedemption,
  LoyaltyReward,
  LoyaltySettings,
  LoyaltyStampEvent,
  LoyaltyTierSetting,
} from '@/lib/loyalty';

export const getLoyaltyOverview = (storeId: string) =>
  apiFetch<LoyaltyOverview>(`/api/loyalty/overview?storeId=${encodeURIComponent(storeId)}`);
export const searchLoyaltyPassports = (storeId: string, query = '') =>
  apiFetch<ApiListResponse<LoyaltyPassport>>(
    `/api/loyalty/passports?storeId=${encodeURIComponent(storeId)}&query=${encodeURIComponent(query)}`,
  );
export const searchLoyaltyCustomers = (storeId: string, search = '') =>
  apiFetch<ApiListResponse<LoyaltyCustomer>>(
    `/api/loyalty/customers?storeId=${encodeURIComponent(storeId)}&search=${encodeURIComponent(search)}`,
  );
export const getLoyaltySettings = (storeId: string) =>
  apiFetch<{ settings: LoyaltySettings; rewards: LoyaltyReward[]; tiers: LoyaltyTierSetting[] }>(
    `/api/loyalty/settings?storeId=${encodeURIComponent(storeId)}`,
  );
export const putLoyaltySettings = (payload: Partial<LoyaltySettings> & { store_id: string }) =>
  apiFetch<{ settings: LoyaltySettings; tiers: LoyaltyTierSetting[] }>('/api/loyalty/settings', {
    method: 'PUT',
    json: payload as Record<string, unknown>,
  });
export const createLoyaltyPassport = (payload: {
  store_id: string;
  customer_name?: string | null;
  customer_phone: string;
}) => apiFetch<LoyaltyPassport>('/api/loyalty/passports', { method: 'POST', json: payload });
export const addLoyaltyStamp = (payload: {
  store_id: string;
  passport_id?: string;
  stamps_earned?: number;
  customer_name?: string | null;
  customer_phone?: string;
  transaction_id?: string | null;
  transaction_amount: number;
  note?: string | null;
  idempotency_key?: string | null;
}) => apiFetch<{
  passport: LoyaltyPassport;
  customer?: LoyaltyCustomer;
  event: LoyaltyStampEvent;
  earned: { stamps: number; points: number };
  replayed?: boolean;
}>('/api/loyalty/stamps', { method: 'POST', json: payload });
export const addKopiPassportStamp = (payload: {
  store_id: string;
  customer_id?: string;
  passport_id?: string;
  name?: string | null;
  phone?: string;
  transaction_id?: string | null;
  transaction_amount: number;
  stamps_earned?: number;
  note?: string | null;
  idempotency_key?: string | null;
}) => apiFetch<{
  passport: LoyaltyPassport;
  customer?: LoyaltyCustomer;
  event: LoyaltyStampEvent;
  earned: { stamps: number; points: number };
  replayed?: boolean;
}>('/api/loyalty/stamp', { method: 'POST', json: payload });
export const redeemLoyaltyReward = (payload: {
  store_id: string;
  passport_id: string;
  reward_id: string;
  transaction_id?: string | null;
  transaction_amount: number;
  idempotency_key?: string | null;
}) => apiFetch<{
  redemption: LoyaltyRedemption;
  passport: LoyaltyPassport;
  customer?: LoyaltyCustomer;
  reward: LoyaltyReward;
  replayed?: boolean;
}>('/api/loyalty/redemptions', { method: 'POST', json: payload });
export const redeemKopiPassportReward = (payload: {
  store_id: string;
  customer_id?: string;
  passport_id?: string;
  reward_id: string;
  transaction_id?: string | null;
  transaction_amount: number;
  idempotency_key?: string | null;
}) => apiFetch<{
  redemption: LoyaltyRedemption;
  passport: LoyaltyPassport;
  customer?: LoyaltyCustomer;
  reward: LoyaltyReward;
  replayed?: boolean;
}>('/api/loyalty/redeem', { method: 'POST', json: payload });
export const updateLoyaltySettings = (payload: Partial<LoyaltySettings> & { store_id: string }) =>
  apiFetch<LoyaltySettings>('/api/loyalty/settings', { method: 'PATCH', json: payload as Record<string, unknown> });
export const createLoyaltyReward = (payload: {
  store_id: string;
  name: string;
  description?: string | null;
  type: LoyaltyReward['type'];
  reward_value: number;
  points_or_stamps_needed?: number;
  points_cost: number;
  stamps_cost: number;
  is_active?: boolean;
}) => apiFetch<LoyaltyReward>('/api/loyalty/rewards', { method: 'POST', json: payload });
export const updateLoyaltyReward = (id: string, payload: Partial<Omit<LoyaltyReward, 'id' | 'store_id' | 'created_at' | 'updated_at'>>) =>
  apiFetch<LoyaltyReward>(`/api/loyalty/rewards/${id}`, { method: 'PATCH', json: payload as Record<string, unknown> });

