/**
 * Pure serializers and derivations for the Kopi Passport loyalty domain.
 *
 * Extracted from routes/loyalty.ts so the route file stays focused on handlers.
 * Every function here is pure: it maps a raw DB row (or a plain input) to a
 * response shape with no database access and no side effects.
 */
import { z } from 'zod';
import { toNumber } from '../core';

export const rewardTypeSchema = z.enum(['discount_amount', 'discount_percent', 'free_item']);
export const tierSchema = z.enum(['regular', 'kopi_lover', 'vvip']);

export function normalizePhone(input: string) {
  const trimmed = input.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return `${hasPlus ? '+' : ''}${digits}`;
}

export function serializeSettings(row: Record<string, unknown>) {
  return {
    store_id: String(row.store_id),
    stamps_required: Math.max(2, Math.round(toNumber(row.stamps_required) || 8)),
    points_per_rupiah: toNumber(row.points_per_rupiah),
    minimum_transaction_amount: Math.max(0, Math.round(toNumber(row.minimum_transaction_amount))),
    is_active: row.is_active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function serializeReward(row: Record<string, unknown>) {
  const pointsCost = Math.max(0, Math.round(toNumber(row.points_cost)));
  const stampsCost = Math.max(0, Math.round(toNumber(row.stamps_cost)));
  return {
    id: String(row.id),
    store_id: String(row.store_id),
    name: String(row.name ?? ''),
    description: row.description == null ? null : String(row.description),
    type: rewardTypeSchema.catch('discount_amount').parse(row.type),
    reward_value: Math.max(0, Math.round(toNumber(row.reward_value))),
    points_or_stamps_needed: Math.max(0, Math.round(toNumber(row.points_or_stamps_needed) || Math.max(pointsCost, stampsCost))),
    points_cost: pointsCost,
    stamps_cost: stampsCost,
    is_active: row.is_active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function serializePassport(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    store_id: String(row.store_id),
    customer_name: row.customer_name == null ? null : String(row.customer_name),
    customer_phone: String(row.customer_phone ?? ''),
    tier: tierSchema.catch('regular').parse(row.tier),
    total_stamps: Math.max(0, Math.round(toNumber(row.total_stamps))),
    available_stamps: Math.max(0, Math.round(toNumber(row.available_stamps))),
    total_points: Math.max(0, Math.round(toNumber(row.total_points))),
    available_points: Math.max(0, Math.round(toNumber(row.available_points))),
    lifetime_spend: Math.max(0, Math.round(toNumber(row.lifetime_spend))),
    last_visit_at: row.last_visit_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function serializeStampEvent(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    store_id: String(row.store_id),
    passport_id: String(row.passport_id),
    transaction_id: row.transaction_id == null ? null : String(row.transaction_id),
    stamps: Math.max(0, Math.round(toNumber(row.stamps))),
    points: Math.max(0, Math.round(toNumber(row.points))),
    transaction_amount: Math.max(0, Math.round(toNumber(row.transaction_amount))),
    note: row.note == null ? null : String(row.note),
    created_at: row.created_at,
  };
}

export function serializeCustomer(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    store_id: String(row.store_id),
    name: row.name == null ? null : String(row.name),
    phone: String(row.phone ?? ''),
    tier: tierSchema.catch('regular').parse(row.tier),
    total_points: Math.max(0, Math.round(toNumber(row.total_points))),
    total_visits: Math.max(0, Math.round(toNumber(row.total_visits))),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function serializeTier(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    store_id: row.store_id == null ? null : String(row.store_id),
    name: String(row.name ?? 'Regular'),
    min_visits: Math.max(0, Math.round(toNumber(row.min_visits))),
    benefits: row.benefits ?? {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function serializeRedemption(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    store_id: String(row.store_id),
    passport_id: String(row.passport_id),
    reward_id: String(row.reward_id),
    transaction_id: row.transaction_id == null ? null : String(row.transaction_id),
    points_spent: Math.max(0, Math.round(toNumber(row.points_spent))),
    stamps_spent: Math.max(0, Math.round(toNumber(row.stamps_spent))),
    discount_amount: Math.max(0, Math.round(toNumber(row.discount_amount))),
    status: String(row.status ?? 'redeemed'),
    created_at: row.created_at,
  };
}

export function deriveTier(input: { lifetimeSpend: number; totalStamps: number; totalPoints: number }) {
  if (input.lifetimeSpend >= 2_000_000 || input.totalStamps >= 48 || input.totalPoints >= 20_000) return 'vvip';
  if (input.lifetimeSpend >= 500_000 || input.totalStamps >= 16 || input.totalPoints >= 5_000) return 'kopi_lover';
  return 'regular';
}

/**
 * Derive a loyalty customer view directly from a passport row, with no DB write.
 * Shared by GET /api/loyalty/overview and GET /api/loyalty/customers so the
 * passport→customer field mapping lives in exactly one place.
 */
export function serializeCustomerFromPassportRow(row: Record<string, unknown>) {
  return serializeCustomer({
    id: row.id,
    store_id: row.store_id,
    name: row.customer_name,
    phone: row.customer_phone,
    tier: row.tier,
    total_points: row.total_points,
    total_visits: row.total_stamps,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}
