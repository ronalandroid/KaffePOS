/** Affiliate & referral endpoint catalog (owner + admin). */
import { apiFetch } from './client';

// ============================================================================
// Affiliate & Referral API
// ============================================================================

export async function generateReferralCode(): Promise<{ code: string; referral_link: string }> {
  return apiFetch('/api/referrals/generate', { method: 'POST', auth: true });
}

export async function getReferralStats(): Promise<import('@/types/affiliate').ReferralStats> {
  return apiFetch('/api/referrals/me', { auth: true });
}

export async function getAffiliateDashboard(): Promise<import('@/types/affiliate').AffiliateDashboardData> {
  return apiFetch('/api/affiliate/me', { auth: true });
}

export async function applyForAffiliate(data: import('@/types/affiliate').AffiliateApplyInput): Promise<{ affiliate_profile: import('@/types/affiliate').AffiliateProfile }> {
  return apiFetch('/api/affiliate/apply', {
    method: 'POST',
    auth: true,
    json: { ...data },
  });
}

export async function updateAffiliatePayoutDetails(data: import('@/types/affiliate').AffiliatePayoutInput): Promise<{ affiliate_profile: import('@/types/affiliate').AffiliateProfile }> {
  return apiFetch('/api/affiliate/me/payout', {
    method: 'PATCH',
    auth: true,
    json: { ...data },
  });
}

export async function getAffiliateCommissions(
  status?: import('@/types/affiliate').CommissionStatus
): Promise<{ items: import('@/types/affiliate').CommissionTransaction[] }> {
  const url = status ? `/api/affiliate/commissions?status=${status}` : '/api/affiliate/commissions';
  return apiFetch(url, { auth: true });
}

// Admin APIs
export async function adminGetAffiliates(params: {
  status?: import('@/types/affiliate').AffiliateStatus | 'all';
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ items: import('@/types/affiliate').AdminAffiliateListItem[]; pagination?: unknown }> {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch(`/api/admin/affiliates${suffix}`, { auth: true });
}

export async function adminGetAffiliateDetail(id: string): Promise<import('@/types/affiliate').AdminAffiliateDetail> {
  return apiFetch(`/api/admin/affiliates/${id}`, { auth: true });
}

export async function adminUpdateAffiliateStatus(
  id: string,
  status: import('@/types/affiliate').AffiliateStatus,
  note?: string
): Promise<{ affiliate_profile: import('@/types/affiliate').AffiliateProfile }> {
  return apiFetch(`/api/admin/affiliates/${id}/status`, {
    method: 'PATCH',
    auth: true,
    json: { status, note },
  });
}

export async function adminGetReferrals(params: {
  status?: string;
  referral_type?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ items: import('@/types/affiliate').AdminReferralListItem[]; pagination?: unknown }> {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.referral_type && params.referral_type !== 'all') query.set('referral_type', params.referral_type);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch(`/api/admin/referrals${suffix}`, { auth: true });
}

export async function adminGetReferralDetail(id: string): Promise<import('@/types/affiliate').AdminReferralDetail> {
  return apiFetch(`/api/admin/referrals/${id}`, { auth: true });
}

export async function adminGetCommissions(params: {
  status?: import('@/types/affiliate').CommissionStatus | 'all';
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ items: import('@/types/affiliate').AdminCommissionListItem[]; pagination?: unknown }> {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.type && params.type !== 'all') query.set('type', params.type);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch(`/api/admin/commissions${suffix}`, { auth: true });
}

export async function adminGetCommissionDetail(id: string): Promise<import('@/types/affiliate').AdminCommissionDetail> {
  return apiFetch(`/api/admin/commissions/${id}`, { auth: true });
}

export async function adminApproveCommission(
  commissionId: string,
  notes?: string
): Promise<{ commission: import('@/types/affiliate').CommissionTransaction }> {
  return apiFetch(`/api/admin/commissions/${commissionId}/approve`, {
    method: 'PATCH',
    auth: true,
    json: { note: notes },
  });
}

export async function adminRejectCommission(
  commissionId: string,
  rejectionReason: string,
  notes?: string
): Promise<{ commission: import('@/types/affiliate').CommissionTransaction }> {
  return apiFetch(`/api/admin/commissions/${commissionId}/reject`, {
    method: 'PATCH',
    auth: true,
    json: { note: rejectionReason || notes || '' },
  });
}

export async function adminMarkCommissionPaid(
  commissionId: string,
  notes?: string
): Promise<{ commission: import('@/types/affiliate').CommissionTransaction }> {
  return apiFetch(`/api/admin/commissions/${commissionId}/mark-paid`, {
    method: 'PATCH',
    auth: true,
    json: { note: notes },
  });
}
