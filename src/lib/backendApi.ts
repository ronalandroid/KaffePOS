import type {
  CashFlowEntry,
  CashRegister,
  Expense,
  InventoryItem,
  MenuItem,
  StockUnitConversion,
  StoreSettings,
  Transaction,
} from '@/types';
import type { Permission, UserRole } from '@/lib/accessControl';
import type { SubscriptionBillingQuote, SubscriptionPaymentMethod, SubscriptionPaymentMethodId } from '@/lib/subscriptionBilling';
import type { BulkImportMode, BulkImportPreview, BulkImportRow } from '@/lib/stockEngine';
import type {
  Challenge,
  ChallengeProgressSummary,
  TeamChallengeCompletion,
  UserChallengeProgress,
} from '@/lib/challenges';
import type { KaffeNotification, NotificationReadPayload } from '@/lib/notifications';

import { apiFetch, type ApiListResponse, type ApiRecord } from './api/client';

// Re-export the transport core and the extracted endpoint catalogs so every
// existing `@/lib/backendApi` import keeps working unchanged (barrel pattern).
export { ApiError, apiFetch, buildApiUrl, resolveApiBaseUrl } from './api/client';
export * from './api/loyalty';
export * from './api/kitchen';
export * from './api/affiliate';
export * from './api/fnb';


export type SystemStatusResponse = {
  ok: boolean;
  service: string;
  version: string;
  env: string;
  time: string;
  checks: {
    backend: { ok: boolean };
    database: { ok: boolean; latencyMs?: number | null };
    email: { ok: boolean; provider: string; fromEmail: string | null };
    payment: {
      ok: boolean;
      commerciallyReady?: boolean;
      provider: string;
      environment: string;
      merchantId: string | null;
    };
    monitoring?: {
      backendErrorTracking: boolean;
      provider: string;
    };
  };
  syncMatrix: Record<string, boolean>;
  readiness: Record<string, number>;
  warnings?: string[];
};

export type AppVersionResponse = {
  ok: boolean;
  appVersion: string;
  apiVersion: string;
  databaseSchemaVersion: string | null;
  releaseChannel: string;
  releaseNotes: string | null;
  updateMode: 'none' | 'soft' | 'hard';
  hardUpdateRequired: boolean;
  softUpdateAvailable: boolean;
  minimumSupportedVersion: string;
  sync: {
    postUpdateSyncRecommended: boolean;
    migrationEndpoint: string;
  };
  checkedAt: string;
};

export type AuthSessionResponse = {
  accessToken: string;
  expiresAt: string;
  user: {
    id: string;
    email: string | null;
    email_verified_at?: string | null;
    user_metadata?: Record<string, unknown> | null;
  };
  profile: ProfileResponse;
};

export const loginRequest = (payload: { email: string; password: string }) =>
  apiFetch<AuthSessionResponse>('/api/auth/login', {
    method: 'POST',
    auth: false,
    json: payload,
  });

export const registerRequest = (payload: { email: string; password: string; username: string }) =>
  apiFetch<{ success: boolean; needsVerification: boolean; message: string }>('/api/auth/register', {
    method: 'POST',
    auth: false,
    json: payload,
  });

export const resendVerificationRequest = (payload: { email: string }) =>
  apiFetch<{ success: boolean; message: string }>('/api/auth/verification/resend', {
    method: 'POST',
    auth: false,
    json: payload,
  });

export const verifyEmailCodeRequest = (payload: { email: string; code: string }) =>
  apiFetch<{ success: boolean; message: string }>('/api/auth/verification/confirm', {
    method: 'POST',
    auth: false,
    json: payload,
  });

export const forgotPasswordRequest = (payload: { email: string }) =>
  apiFetch<{ success: boolean; message: string }>('/api/auth/password/forgot', {
    method: 'POST',
    auth: false,
    json: payload,
  });

export const resetPasswordRequest = (payload: { email: string; token: string; password: string }) =>
  apiFetch<{ success: boolean; message: string }>('/api/auth/password/reset', {
    method: 'POST',
    auth: false,
    json: payload,
  });

export const getAuthSession = () => apiFetch<{ user: AuthSessionResponse['user']; profile: ProfileResponse; sessionExpiresAt: string }>('/api/auth/session');
export const logoutRequest = () => apiFetch<{ success: boolean }>('/api/auth/logout', {
  method: 'POST',
  json: {},
});
export const getSystemStatus = () => apiFetch<SystemStatusResponse>('/system-status', { auth: false });
export const getAppVersion = (params: { clientVersion: string; platform: 'web' | 'apk' | 'android' | 'ios' | 'unknown' }) =>
  apiFetch<AppVersionResponse>(
    `/api/app/version?clientVersion=${encodeURIComponent(params.clientVersion)}&platform=${encodeURIComponent(params.platform)}`,
    { auth: false },
  );
export const logAppUpdateEvent = (payload: {
  store_id?: string | null;
  event_name:
    | 'version_checked'
    | 'update_detected'
    | 'client_storage_migrated'
    | 'post_update_sync_started'
    | 'post_update_sync_completed'
    | 'post_update_sync_failed';
  client_version?: string | null;
  server_version?: string | null;
  platform: 'web' | 'apk' | 'android' | 'ios' | 'unknown';
  update_mode?: 'none' | 'soft' | 'hard';
  migration_report?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) => apiFetch<{ success: boolean }>('/api/app/update-events', {
  method: 'POST',
  json: payload,
});

export type ProfileResponse = {
  id: string;
  username?: string;
  display_name?: string;
  email?: string;
  avatar_url?: string;
  role?: UserRole;
  permissions?: Permission[];
  account_status?: 'active' | 'inactive';
  owner_id?: string;
  assigned_store_id?: string;
  assigned_store_name?: string;
  assignment_status?: 'active' | 'inactive';
  tier?: string;
  tier_expires_at?: string | null;
  is_pro?: boolean;
  pro_plan?: string | null;
  pro_order_id?: string | null;
  pro_activated_at?: string | null;
  pro_expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type StoreResponse = StoreSettings & ApiRecord;
export type SubscriptionRecord = {
  id: string;
  plan: string;
  billing_cycle: string;
  status: string;
  activated_at: string;
  expires_at: string | null;
  payment_amount: number | null;
} & ApiRecord;

export type PaymentHistoryRecord = {
  id: string;
  plan: string;
  billing_cycle: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  status: string;
  payment_note: string | null;
} & ApiRecord;

export type PendingPaymentRecord = {
  id: string;
  plan: string;
  billing_cycle: string;
  amount: number;
  redirect_url: string | null;
  transaction_status: string;
  expires_at: string | null;
  created_at: string;
} & ApiRecord;

export type SecurePaymentCreatePayload = {
  store_id: string;
  items: Array<{
    id: string;
    qty: number;
    variant_name?: string | null;
    note?: string | null;
  }>;
  discount_amount?: number;
  customer?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
};

export type SecurePaymentCreateResponse = {
  order_id: string;
  status: 'pending';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  gross_amount: number;
  provider?: string | null;
  payment_url: string | null;
  expires_at: string;
};

export type SecurePaymentOrderStatus = {
  order_id: string;
  status: 'pending' | 'paid' | 'completed' | 'failed' | 'cancelled';
  transaction_status: string;
  payment_type: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  gross_amount: number;
  customer_name: string | null;
  items: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
    note: string | null;
    subtotal: number;
  }>;
  transaction_id: string | null;
  transaction: Transaction | null;
  paid_at: string | null;
  failed_at: string | null;
  expires_at: string | null;
};

export type AdminProfileResponse = {
  id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  role?: UserRole;
} & ApiRecord;

export type AdminSubscriptionRecord = SubscriptionRecord & {
  user_id: string;
};

export type AdminPaymentHistoryRecord = PaymentHistoryRecord & {
  user_id: string;
};
export type CashierAccount = {
  id: string;
  display_name: string | null;
  email: string | null;
  username: string | null;
  role: 'cashier';
  status: 'active' | 'inactive';
  store_id: string;
  store_name: string;
  created_at?: string;
  updated_at?: string;
} & ApiRecord;
export type SubscriptionPaymentSession = {
  redirect_url?: string;
  payment_url?: string | null;
  provider?: string;
  merchant_order_id?: string;
  token?: string;
  order_id?: string;
  status?: string;
} & ApiRecord;

export type GenericPaymentStartResponse = {
  success: true;
  data: {
    paymentId: string;
    provider: 'mayar' | 'doku' | 'disabled' | string;
    merchantOrderId: string;
    paymentUrl: string | null;
    status: string;
  };
};

export type SubscriptionUsageLimits = {
  storeId: string;
  ownerId: string;
  currentPlan: 'secangkir' | 'kopi_susu' | 'signature' | 'founder';
  transactionLimit: number;
  transactionsUsed: number;
  transactionsRemaining: number | null;
  percentUsed: number;
  period: {
    type: 'monthly';
    startsAt: string;
  };
  firstActivityAt: string | null;
  daysSinceFirstActivity: number;
  shouldShowTransactionLimitPrompt: boolean;
  shouldShowAppAgePrompt: boolean;
  isTrial?: boolean;
  trialEndsAt?: string | null;
  trialDaysRemaining?: number | null;
  shouldShowTrialUpgradePrompt?: boolean;
};

export type UpgradePromptEventPayload = {
  event_type: 'view' | 'click' | 'dismiss';
  prompt_key: string;
  trigger: string;
  recommended_plan?: 'kopi_susu' | 'signature';
  store_id?: string | null;
  current_plan?: string | null;
  metadata?: Record<string, unknown>;
};

export type EnhancedAiInsightType =
  | 'sales_trend'
  | 'menu_optimization'
  | 'staff_performance'
  | 'stock_waste'
  | 'peak_hour';

export type EnhancedAiInsightCard = {
  id: string;
  type: EnhancedAiInsightType;
  title: string;
  description: string;
  impact: string;
  confidence: number;
  metricLabel: string;
  metricValue: string;
};

export type EnhancedAiRecommendation = {
  id: string;
  type: EnhancedAiInsightType;
  priority: 'high' | 'medium' | 'low' | string;
  title: string;
  action: string;
  impact: string;
};

export type EnhancedAiInsightsResponse = {
  storeId: string;
  storeName: string;
  generatedAt: string;
  cachedUntil: string;
  fromCache: boolean;
  kopiScore: {
    score: number;
    label: string;
    explanation: string;
    drivers: string[];
  };
  summary: string;
  insights: EnhancedAiInsightCard[];
  recommendations: EnhancedAiRecommendation[];
  charts: {
    salesTrend: Array<{ label: string; value: number }>;
    peakHours: Array<{ label: string; transactions: number; revenue: number }>;
    menuPerformance: Array<{ label: string; qty: number; revenue: number }>;
    staffPerformance: Array<{ label: string; transactions: number; revenue: number; upsellRate: number; avgItems: number }>;
  };
  dataCoverage: {
    transactions: number;
    days: number;
    menuItems: number;
    inventoryItems: number;
  };
};

export const getProfileMe = () => apiFetch<ProfileResponse>('/api/profile/me');
export const updateProfileMe = (payload: Record<string, unknown>) =>
  apiFetch<ProfileResponse>('/api/profile/me', { method: 'PATCH', json: payload });

export const getStores = (storeId?: string) =>
  apiFetch<ApiListResponse<StoreResponse>>(`/api/stores${storeId ? `?storeId=${encodeURIComponent(storeId)}` : ''}`);
export const createStore = (payload: { store_name?: string }) =>
  apiFetch<StoreResponse>('/api/stores', { method: 'POST', json: payload });
export const updateStore = (storeId: string, payload: Record<string, unknown>) =>
  apiFetch<StoreResponse>(`/api/stores/${storeId}`, { method: 'PATCH', json: payload });

export const getCashiers = () =>
  apiFetch<ApiListResponse<CashierAccount>>('/api/cashiers');
export const createCashier = (payload: {
  displayName: string;
  email: string;
  password: string;
  storeId: string;
  status: 'active' | 'inactive';
}) => apiFetch<{ cashier: CashierAccount }>('/api/cashiers', { method: 'POST', json: payload });
export const updateCashier = (id: string, payload: {
  displayName?: string;
  email?: string;
  password?: string;
  storeId?: string;
  status?: 'active' | 'inactive';
}) => apiFetch<{ cashier: CashierAccount }>(`/api/cashiers/${id}`, { method: 'PATCH', json: payload });

export const getMenuItems = (storeId: string) =>
  apiFetch<ApiListResponse<MenuItem>>(`/api/menu-items?storeId=${encodeURIComponent(storeId)}`);
export const createMenuItem = (payload: Record<string, unknown>) =>
  apiFetch<MenuItem>('/api/menu-items', { method: 'POST', json: payload });
export const updateMenuItem = (id: string, payload: Record<string, unknown>) =>
  apiFetch<MenuItem>(`/api/menu-items/${id}`, { method: 'PATCH', json: payload });
export const removeMenuItem = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/menu-items/${id}`, { method: 'DELETE' });

export type StaffPerformanceResponse = {
  personal: { points: number; transactions: number };
  team: { points: number; transactions: number };
};
export const getStaffPerformance = (storeId: string, staffName: string) =>
  apiFetch<StaffPerformanceResponse>(
    `/api/staff/performance?storeId=${encodeURIComponent(storeId)}&staffName=${encodeURIComponent(staffName)}`,
  );

export const getInventory = (storeId: string) =>
  apiFetch<ApiListResponse<InventoryItem>>(`/api/inventory?storeId=${encodeURIComponent(storeId)}`);
export const createInventoryItem = (payload: Record<string, unknown>) =>
  apiFetch<InventoryItem>('/api/inventory', { method: 'POST', json: payload });
export const updateInventoryItem = (id: string, payload: Record<string, unknown>) =>
  apiFetch<InventoryItem>(`/api/inventory/${id}`, { method: 'PATCH', json: payload });
export const removeInventoryItem = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/inventory/${id}`, { method: 'DELETE' });
export const createInventoryAdjustment = (payload: {
  store_id: string;
  inventory_id: string;
  counted_stock: number;
  reason: string;
  note?: string | null;
}) => apiFetch<InventoryItem>('/api/inventory/adjustments', { method: 'POST', json: payload });
export const getStockUnitConversions = (storeId: string) =>
  apiFetch<ApiListResponse<StockUnitConversion>>(`/api/inventory/conversions?storeId=${encodeURIComponent(storeId)}`);
export const createStockUnitConversion = (payload: Record<string, unknown>) =>
  apiFetch<StockUnitConversion>('/api/inventory/conversions', { method: 'POST', json: payload });
export const updateStockUnitConversion = (id: string, payload: Record<string, unknown>) =>
  apiFetch<StockUnitConversion>(`/api/inventory/conversions/${id}`, { method: 'PATCH', json: payload });
export const deleteStockUnitConversion = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/inventory/conversions/${id}`, { method: 'DELETE' });
export const commitStockBulkImport = (payload: {
  store_id: string;
  mode: BulkImportMode;
  rows: BulkImportRow[];
}) => apiFetch<{
  success: boolean;
  summary: BulkImportPreview['summary'];
  committed: BulkImportPreview['summary'];
}>('/api/inventory/bulk-import/commit', { method: 'POST', json: payload as unknown as Record<string, unknown> });

export const getExpenses = (storeId: string) =>
  apiFetch<ApiListResponse<Expense>>(`/api/expenses?storeId=${encodeURIComponent(storeId)}`);
export const createExpense = (payload: Record<string, unknown>) =>
  apiFetch<Expense>('/api/expenses', { method: 'POST', json: payload });
export const removeExpense = (id: string) =>
  apiFetch<{ success: boolean }>(`/api/expenses/${id}`, { method: 'DELETE' });

export const getCashFlow = (storeId: string) =>
  apiFetch<ApiListResponse<CashFlowEntry>>(`/api/cash-flow?storeId=${encodeURIComponent(storeId)}`);
export const createCashFlow = (payload: Record<string, unknown>) =>
  apiFetch<CashFlowEntry>('/api/cash-flow', { method: 'POST', json: payload });

export const getCashRegister = (storeId: string) =>
  apiFetch<ApiListResponse<CashRegister>>(`/api/cash-register?storeId=${encodeURIComponent(storeId)}`);
export const createCashRegister = (payload: Record<string, unknown>) =>
  apiFetch<CashRegister>('/api/cash-register', { method: 'POST', json: payload });
export const updateCashRegisterEntry = (id: string, payload: Record<string, unknown>) =>
  apiFetch<CashRegister>(`/api/cash-register/${id}`, { method: 'PATCH', json: payload });

export type SubscriptionPaymentConfig = {
  mode: 'manual' | 'disabled' | 'mayar_sandbox' | 'mayar_production' | 'doku_sandbox' | 'doku_production';
  provider: string;
  environment?: 'sandbox' | 'production';
  mayarEnvironment?: 'sandbox' | 'production';
  dokuEnvironment?: 'sandbox' | 'production';
  onlinePaymentAvailable: boolean;
  manualActivationAvailable: boolean;
  commerciallyReady: boolean;
  message: string;
  recommendedAction: string;
};

export const getSubscriptions = () =>
  apiFetch<{
    currentSubscription: SubscriptionRecord | null;
    subscriptions: SubscriptionRecord[];
    paymentHistory: PaymentHistoryRecord[];
    pendingPayments: PendingPaymentRecord[];
    paymentConfig?: SubscriptionPaymentConfig;
  }>('/api/subscriptions');

export const createPayment = (payload: SecurePaymentCreatePayload) =>
  apiFetch<SecurePaymentCreateResponse>('/api/payment/create-transaction', {
    method: 'POST',
    json: payload,
  });

export const getPaymentOrderStatus = (orderId: string) =>
  apiFetch<SecurePaymentOrderStatus>(`/api/payment/orders/${encodeURIComponent(orderId)}`);

export const createSecurePayment = (payload: SecurePaymentCreatePayload) =>
  apiFetch<SecurePaymentCreateResponse>('/api/payment/create', {
    method: 'POST',
    json: payload,
  });

export const createSubscriptionPayment = (payload: {
  plan: 'kopi_susu' | 'signature';
  billingCycle: 'monthly' | 'quarterly' | 'semiannual' | 'yearly';
  paymentMethod: SubscriptionPaymentMethodId;
  voucherCode?: string | null;
}) => apiFetch<{ reused: boolean; payment: SubscriptionPaymentSession; quote: SubscriptionBillingQuote }>('/api/subscriptions/payments/create', {
  method: 'POST',
  json: payload,
});

export const startPayment = (payload: {
  plan: 'kopi_susu' | 'signature';
  billingCycle: 'monthly' | 'quarterly' | 'semiannual' | 'yearly';
  paymentMethod: SubscriptionPaymentMethodId;
  voucherCode?: string | null;
}) => apiFetch<GenericPaymentStartResponse>('/api/payments/start', {
  method: 'POST',
  json: payload,
});

export const getPaymentStatus = (paymentId: string) =>
  apiFetch<GenericPaymentStartResponse['data']>(`/api/payments/${encodeURIComponent(paymentId)}/status`);

export const checkPaymentStatus = (paymentId: string) =>
  apiFetch<GenericPaymentStartResponse['data']>(`/api/payments/${encodeURIComponent(paymentId)}/check`, { method: 'POST', json: {} });

export const getSubscriptionPaymentQuote = (payload: {
  plan: 'kopi_susu' | 'signature';
  billingCycle: 'monthly' | 'quarterly' | 'semiannual' | 'yearly';
  paymentMethod: SubscriptionPaymentMethodId;
  voucherCode?: string | null;
}) => apiFetch<{ quote: SubscriptionBillingQuote; paymentMethods: SubscriptionPaymentMethod[]; paymentConfig?: SubscriptionPaymentConfig }>('/api/subscriptions/payments/quote', {
  method: 'POST',
  json: payload,
});

export const getSubscriptionUsageLimits = (storeId?: string | null) =>
  apiFetch<SubscriptionUsageLimits>(`/api/subscriptions/usage-limits${storeId ? `?storeId=${encodeURIComponent(storeId)}` : ''}`);

export const logUpgradePromptEvent = (payload: UpgradePromptEventPayload) =>
  apiFetch<{ success: boolean }>('/api/subscriptions/upgrade-prompts/log', {
    method: 'POST',
    json: payload,
  });

export const trackOpsEventRequest = (payload: {
  event_name:
    | 'login'
    | 'register'
    | 'checkout'
    | 'transaction_created'
    | 'first_transaction'
    | 'upgrade_clicked'
    | 'gamification_used'
    | 'loyalty_used'
    | 'pdf_exported'
    | 'payment_started'
    | 'payment_completed'
    | 'feedback_submitted'
    | 'client_error'
    | 'printer_error'
    | 'sync_error';
  status: 'success' | 'failure';
  email?: string;
  store_id?: string;
  transaction_id?: string;
  error_message?: string;
  metadata?: Record<string, unknown>;
}) => apiFetch<{ success: boolean }>('/api/ops/events', {
  method: 'POST',
  json: payload,
});

export const requestAiInsight = (payload: { prompt: string }) =>
  apiFetch<{
    summary: string;
    bestMenu: string;
    stockAlert: string;
    prediction: string;
    tips: string[];
  }>('/api/ai-insight', {
    method: 'POST',
    json: payload,
  });

export const getEnhancedAiInsights = (storeId: string, options?: { refresh?: boolean }) =>
  apiFetch<EnhancedAiInsightsResponse>(
    `/api/ai-insights?storeId=${encodeURIComponent(storeId)}${options?.refresh ? '&refresh=1' : ''}`,
  );

export const getAdminSubscriptionOverview = () =>
  apiFetch<{ profiles: AdminProfileResponse[]; subscriptions: AdminSubscriptionRecord[]; paymentHistory: AdminPaymentHistoryRecord[] }>('/api/admin/subscriptions/overview');
export const activateAdminSubscription = (payload: {
  userId: string;
  plan: string;
  billingCycle: string;
  paymentAmount: number;
  paymentNote?: string;
}) => apiFetch<{ success: boolean; subscription: SubscriptionRecord; message: string }>('/api/admin/subscriptions/activate', {
  method: 'POST',
  json: payload,
});
export const cancelAdminSubscription = (id: string) =>
  apiFetch<{ success: boolean; subscription: SubscriptionRecord; message: string }>(`/api/admin/subscriptions/${id}/cancel`, {
    method: 'POST',
    json: {},
  });

export const getNotifications = (limit = 20, category?: string) =>
  apiFetch<{ items: KaffeNotification[]; unreadCount: number }>(
    `/api/notifications?limit=${limit}${category && category !== 'all' ? `&category=${encodeURIComponent(category)}` : ''}`,
  );
export const markNotificationsRead = (payload: NotificationReadPayload = {}) =>
  apiFetch<{ updated: number }>('/api/notifications/mark-read', { method: 'POST', json: payload });
export const markAllNotificationsRead = () =>
  apiFetch<{ updated: number }>('/api/notifications/read-all', { method: 'PATCH', json: {} });
export const registerPushSubscription = (payload: {
  store_id?: string;
  channel: 'web_push' | 'capacitor_android';
  endpoint: string;
  payload: Record<string, unknown>;
  platform?: string | null;
}) => apiFetch<ApiRecord>('/api/notifications/push-subscription', { method: 'POST', json: payload });
export const submitBetaFeedback = (payload: {
  store_id?: string | null;
  rating?: number | null;
  category?: 'Bug' | 'Saran' | 'Fitur Baru' | 'Lainnya';
  description?: string;
  screenshot_data?: string | null;
  liked?: string;
  improve?: string;
  metadata?: Record<string, unknown>;
}) => apiFetch<ApiRecord>('/api/beta-feedback', { method: 'POST', json: payload });

export const getTransactions = (storeId: string) =>
  apiFetch<ApiListResponse<Transaction>>(`/api/transactions?storeId=${encodeURIComponent(storeId)}`);
export const checkoutTransaction = (payload: Record<string, unknown>) =>
  apiFetch<Transaction>('/api/transactions/checkout', { method: 'POST', json: payload });
export const voidTransactionRequest = (
  id: string,
  payload: { store_id: string; reason?: string; void_by?: string },
) => apiFetch<Transaction>(`/api/transactions/${id}/void`, { method: 'POST', json: payload });

export const getActiveChallenges = (storeId: string) =>
  apiFetch<ApiListResponse<Challenge>>(`/api/challenges/active?storeId=${encodeURIComponent(storeId)}`);
export const getMyChallengeProgress = (storeId: string) =>
  apiFetch<{
    items: UserChallengeProgress[];
    challenges: Challenge[];
    summary: ChallengeProgressSummary;
  }>(`/api/challenges/my-progress?storeId=${encodeURIComponent(storeId)}`);
export const checkChallengeCompletion = (payload: {
  store_id: string;
  transaction_id?: string | null;
  checkout_time_seconds?: number | null;
  upsell_value?: number | null;
}) => apiFetch<{ items: UserChallengeProgress[]; completed: Challenge[] }>('/api/challenges/check-completion', {
  method: 'POST',
  json: payload,
});
export const getTeamChallengeCompletion = (storeId: string) =>
  apiFetch<TeamChallengeCompletion>(`/api/challenges/team-completion?storeId=${encodeURIComponent(storeId)}`);
export const updateChallenge = (id: string, payload: { store_id: string; is_active?: boolean }) =>
  apiFetch<Challenge>(`/api/challenges/${id}`, { method: 'PATCH', json: payload });

export const importLocalStoragePayload = (payload: {
  store_id: string;
  store_settings?: Record<string, unknown> | null;
  menu_items?: Record<string, unknown>[];
  inventory_items?: Record<string, unknown>[];
  transactions?: Record<string, unknown>[];
  expenses?: Record<string, unknown>[];
  cash_flow?: Record<string, unknown>[];
  store_accounts?: Record<string, unknown>[];
}) => apiFetch<{
  success: boolean;
  migrated: string[];
  errors: string[];
  skipped: string[];
}>('/api/import/local-storage', {
  method: 'POST',
  json: payload,
});

