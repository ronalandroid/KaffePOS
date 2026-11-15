/**
 * Mayar Headless API v2 payment provider.
 *
 * Docs: https://docs.mayar.id/api-reference-v2/introduction
 *   Production API: https://api.mayar.id/hl/v2   — API key from https://web.mayar.id/api-keys
 *   Sandbox API:    https://api.mayar.io/hl/v2   — API key from https://web.mayar.io/api-keys
 *
 * KaffePOS is wired to Mayar with three things:
 *   1. MAYAR_API_KEY       Bearer token for every API call (create payment, status check).
 *   2. MAYAR_WEBHOOK_TOKEN The "Web Token" from the Mayar dashboard. Mayar sends it in the
 *                          `X-Callback-Token` header; `?token=` on the webhook URL also works.
 *   3. Webhook URL         `${API_BASE_URL}/api/webhooks/mayar` registered in
 *                          Mayar → Integrasi → Webhook (or with `npm run mayar:connect`).
 *
 * Mayar does not sign webhook bodies. A `payment.received` event is therefore never
 * trusted on its own: the webhook route re-reads the payment request from this API
 * (see `checkTransactionStatus`) before anything is marked paid.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError, env, log, serializeError } from '../../core';
import { mayarCircuitBreaker } from '../../architecture/circuitBreaker';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  InternalPaymentStatus,
  PaymentCallbackInput,
  PaymentProvider,
  PaymentStatusResult,
  VerifiedPaymentCallback,
} from '../payment-provider.types';

/** Path prefix of the Mayar Headless API v2. */
export const MAYAR_API_PREFIX = '/hl/v2';
export const MAYAR_WEBHOOK_UPDATE_PATH = `${MAYAR_API_PREFIX}/webhooks/update`;
export const MAYAR_WEBHOOK_TEST_PATH = `${MAYAR_API_PREFIX}/webhooks/test`;

/** Webhook events that describe a payment. Everything else (membership, shipping) is ignored. */
export const MAYAR_PAYMENT_EVENTS = new Set(['payment.received', 'payment.reminder']);

/** Headers that may carry the webhook token. `X-Callback-Token` is what Mayar sends. */
const WEBHOOK_TOKEN_HEADERS = ['x-callback-token', 'x-mayar-callback-token', 'x-webhook-token', 'x-mayar-token'];
/** Query-string names accepted for URL-token mode (`/api/webhooks/mayar?token=...`). */
const WEBHOOK_TOKEN_QUERY_KEYS = ['token', 'webhook_token'];
/**
 * Headers that may carry an HMAC-SHA256 of the raw body keyed with the webhook token.
 * Mayar documents no signature scheme; accepting one only adds a stricter way to prove
 * possession of the same secret.
 */
const WEBHOOK_SIGNATURE_HEADERS = ['x-mayar-signature', 'x-callback-signature', 'x-signature', 'signature'];

const FALLBACK_MOBILE = '081234567890';
const FALLBACK_EMAIL = 'customer@kaffepos.my.id';
const REQUEST_TIMEOUT_MS = 15_000;

const PAID_STATUSES = new Set([
  'paid', 'settled', 'settlement', 'success', 'succeeded', 'completed', 'complete', 'true', 'payment.received',
]);
const PENDING_STATUSES = new Set([
  'unpaid', 'pending', 'created', 'active', 'waiting', 'open', 'processing', 'payment.reminder',
]);
const CANCELLED_STATUSES = new Set(['closed', 'cancelled', 'canceled', 'cancel', 'void']);
const FAILED_STATUSES = new Set(['failed', 'failure', 'fail', 'deny', 'denied', 'rejected', 'false']);

type MayarResponse = { status: number; ok: boolean; body: Record<string, unknown> };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0)));
}

function readHeader(headers: Record<string, string | string[] | undefined> | undefined, name: string): string {
  if (!headers) return '';
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return (Array.isArray(value) ? value[0] ?? '' : value ?? '').trim();
    }
  }
  return '';
}

function readQueryValue(query: Record<string, unknown> | undefined, name: string): string {
  if (!query) return '';
  const value = query[name];
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0].trim();
  return '';
}

/**
 * Constant-time token comparison. Both sides are hashed first so neither the
 * comparison time nor an early length check leaks anything about the secret.
 */
export function webhookTokensMatch(candidate: string, secret: string): boolean {
  const left = candidate.trim();
  const right = secret.trim();
  if (!left || !right) return false;
  const a = createHash('sha256').update(left, 'utf8').digest();
  const b = createHash('sha256').update(right, 'utf8').digest();
  return timingSafeEqual(a, b);
}

function normalizePhone(phone?: string | null): string | null {
  const cleaned = (phone ?? '').replace(/[^\d+]/g, '').trim();
  return cleaned.replace(/\D/g, '').length >= 10 ? cleaned : null;
}

function extractBracketOrderId(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const match = text.match(/\[([A-Za-z0-9_-]{4,120})\]/);
  return match?.[1] ?? null;
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return parseTimestamp(Number(trimmed));
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

function parseAmount(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const amount = Number(value);
    if (Number.isFinite(amount)) return Math.round(amount);
  }
  return null;
}

/**
 * Mayar returns `messages` (or `message`); validation errors add an array of
 * details in `data`. All of them are joined so callers can match on any part.
 */
export function extractMayarMessage(body: Record<string, unknown>): string | null {
  const parts: string[] = [];
  for (const candidate of [body.messages, body.message, body.data]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      parts.push(candidate.trim());
    } else if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        const text = typeof entry === 'string' ? entry : pickString(asRecord(entry).message, asRecord(entry).msg);
        if (text) parts.push(text.trim());
      }
    }
  }
  return parts.length ? Array.from(new Set(parts)).join('; ') : null;
}

/** Event name from either `{ event: "payment.received" }` or `{ event: { received: "payment.received" } }`. */
export function extractMayarEventName(body: Record<string, unknown>): string | null {
  if (typeof body.event === 'string' && body.event.trim()) return body.event.trim().toLowerCase();
  const eventObject = asRecord(body.event);
  const nested = pickString(eventObject.received, eventObject.name, eventObject.type);
  if (nested) return nested.toLowerCase();
  const fallback = pickString(body.type, body.eventType, body.event_type);
  return fallback ? fallback.toLowerCase() : null;
}

export class MayarPaymentProvider implements PaymentProvider {
  readonly providerName = 'mayar' as const;

  get baseUrl(): string {
    const base = env.MAYAR_ENVIRONMENT === 'production' ? env.MAYAR_PRODUCTION_BASE_URL : env.MAYAR_SANDBOX_BASE_URL;
    return base.replace(/\/+$/, '');
  }

  /** Webhook token configured for this deployment, or null when it is missing. */
  get webhookToken(): string | null {
    const token = env.MAYAR_WEBHOOK_TOKEN?.trim();
    return token ? token : null;
  }

  private get apiKey(): string {
    const key = env.MAYAR_API_KEY?.trim();
    if (!key) {
      throw new ApiError(503, 'Mayar API key belum dikonfigurasi.');
    }
    return key;
  }

  private resolvePath(path: string): string {
    const trimmed = path.trim();
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  /**
   * Authenticated call to the Mayar API. Network errors and 5xx responses count
   * against the circuit breaker; 4xx responses are returned to the caller.
   */
  private async request(method: 'GET' | 'POST', path: string, payload?: Record<string, unknown>): Promise<MayarResponse> {
    const url = `${this.baseUrl}${this.resolvePath(path)}`;
    const apiKey = this.apiKey;
    return mayarCircuitBreaker.execute(async () => {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const body = asRecord(await response.json().catch(() => ({})));
      if (response.status >= 500) {
        throw new ApiError(502, `Mayar sedang tidak bisa dihubungi (${response.status}).`);
      }
      return { status: response.status, ok: response.ok, body };
    });
  }

  /** Mayar payment channel id for a KaffePOS payment method id (informational only). */
  mapPaymentMethodChannel(method?: string | null): string | undefined {
    const normalized = (method ?? '').trim().toLowerCase();
    if (!normalized) return undefined;
    if (normalized === 'qris') return 'qris';
    if (normalized === 'bni_va' || normalized === 'va/bni') return 'va/bni';
    if (normalized === 'bri_va' || normalized === 'va/bri') return 'va/bri';
    if (normalized === 'mandiri_bill' || normalized === 'mandiri_va' || normalized === 'va/mandiri') return 'va/mandiri';
    if (normalized === 'cimb_va' || normalized === 'va/cimb') return 'va/cimb';
    if (normalized === 'permata_va' || normalized === 'va/permata') return 'va/permata';
    if (normalized === 'bjb_va' || normalized === 'va/bjb') return 'va/bjb';
    if (normalized === 'bsi_va' || normalized === 'va/bsi') return 'va/bsi';
    return undefined;
  }

  /**
   * Checks the webhook against MAYAR_WEBHOOK_TOKEN (the dashboard "Web Token").
   * Accepts the `X-Callback-Token` header (and a few aliases), `Authorization: Bearer`,
   * `?token=` on the webhook URL, or an HMAC-SHA256 of the raw body keyed with the token.
   * The API key is never accepted as a webhook token.
   */
  verifyWebhookToken(params: Pick<PaymentCallbackInput, 'headers' | 'query' | 'rawBody' | 'body'>): boolean {
    const secret = this.webhookToken;
    if (!secret) return false;

    const authorization = readHeader(params.headers, 'authorization');
    const bearer = /^bearer\s+/i.test(authorization) ? authorization.replace(/^bearer\s+/i, '').trim() : '';
    const signatures = WEBHOOK_SIGNATURE_HEADERS.map((name) =>
      readHeader(params.headers, name).replace(/^(sha256|hmacsha256|hmac-sha256)=/i, '').trim(),
    ).filter(Boolean);
    const candidates = [
      ...WEBHOOK_TOKEN_HEADERS.map((name) => readHeader(params.headers, name)),
      bearer,
      ...WEBHOOK_TOKEN_QUERY_KEYS.map((name) => readQueryValue(params.query, name)),
      ...signatures,
    ].filter(Boolean);

    if (candidates.some((candidate) => webhookTokensMatch(candidate, secret))) return true;
    if (signatures.length === 0) return false;

    const rawBody = params.rawBody ?? (params.body ? JSON.stringify(params.body) : '');
    if (!rawBody) return false;
    const hex = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const base64 = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    return signatures.some(
      (signature) => webhookTokensMatch(signature.toLowerCase(), hex) || webhookTokensMatch(signature, base64),
    );
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new ApiError(400, 'Nominal pembayaran tidak valid.');
    }

    const amount = Math.round(input.amount);
    const expiredAt = new Date(Date.now() + env.MAYAR_PAYMENT_DUE_MINUTES * 60_000).toISOString();
    const redirectUrl = input.returnUrl?.trim() || undefined;
    const createPath = this.resolvePath(env.MAYAR_CREATE_PAYMENT_PATH);
    const isInvoiceEndpoint = createPath.includes('/invoices/');
    const mobile = normalizePhone(input.customerPhone);
    const title = (input.customerName || input.productDetails || input.merchantOrderId).slice(0, 100);
    const description = `${(input.productDetails || input.merchantOrderId).slice(0, 180)} [${input.merchantOrderId}]`;

    const payload: Record<string, unknown> = {
      name: title,
      amount,
      email: input.customerEmail || FALLBACK_EMAIL,
      // Invoices require a phone number; payment requests do not, so we only
      // send a placeholder where Mayar insists on one.
      ...(mobile ? { mobile } : isInvoiceEndpoint ? { mobile: FALLBACK_MOBILE } : {}),
      description,
      expiredAt,
      ...(redirectUrl ? { redirectUrl } : {}),
      extraData: {
        ...(input.metadata ?? {}),
        merchantOrderId: input.merchantOrderId,
        orderId: input.merchantOrderId,
        source: 'kaffepos',
      },
      ...(isInvoiceEndpoint
        ? {
            items:
              input.itemDetails && input.itemDetails.length > 0
                ? input.itemDetails.map((item) => ({
                    description: item.name.slice(0, 100),
                    rate: Math.round(item.price),
                    quantity: item.quantity,
                  }))
                : [{ description: (input.productDetails || input.merchantOrderId).slice(0, 100), rate: amount, quantity: 1 }],
          }
        : {}),
    };

    try {
      log('info', 'mayar.create_payment_request', {
        environment: env.MAYAR_ENVIRONMENT,
        baseUrl: this.baseUrl,
        target: createPath,
        merchantOrderId: input.merchantOrderId,
        amount,
        redirectUrlConfigured: Boolean(redirectUrl),
      });

      let { status, ok, body } = await this.request('POST', createPath, payload);

      // Mayar rejects some optional fields depending on the account/endpoint:
      //  - payment requests may refuse `redirectUrl` ("redirectUrl is not supported ...")
      //  - some endpoints insist on `mobile`
      // Retry once per field with the payload adjusted.
      for (let attempt = 0; attempt < 2 && !ok && status === 400; attempt += 1) {
        const message = (extractMayarMessage(body) ?? '').toLowerCase();
        if (payload.redirectUrl && message.includes('redirecturl')) {
          delete payload.redirectUrl;
        } else if (!payload.mobile && message.includes('mobile')) {
          payload.mobile = FALLBACK_MOBILE;
        } else {
          break;
        }
        ({ status, ok, body } = await this.request('POST', createPath, payload));
      }

      const data = asRecord(body.data ?? body);
      const paymentUrl = pickString(data.link, data.linkPayment, data.paymentUrl, data.linkUrl, data.url);
      const providerReference = pickString(data.id, data.paymentRequestId, data.invoiceId);
      const providerTransactionId = pickString(data.transactionId, data.transaction_id);
      const message = extractMayarMessage(body);

      log(ok ? 'info' : 'warn', 'mayar.create_payment_response', {
        environment: env.MAYAR_ENVIRONMENT,
        status,
        merchantOrderId: input.merchantOrderId,
        hasPaymentUrl: Boolean(paymentUrl),
        providerReference,
        providerTransactionId,
        message,
        hint:
          status === 401 || status === 403
            ? 'Periksa MAYAR_API_KEY dan pastikan MAYAR_ENVIRONMENT cocok dengan asal key (sandbox vs production).'
            : undefined,
      });

      if (status === 429) {
        throw new ApiError(502, 'Mayar menolak permintaan ganda. Tunggu 1 menit lalu coba lagi.');
      }
      if (!ok) {
        throw new ApiError(502, `Mayar create payment gagal (${status}).`);
      }
      if (!paymentUrl) {
        throw new ApiError(502, 'Mayar create payment tidak mengembalikan link pembayaran.');
      }

      return {
        provider: 'mayar',
        merchantOrderId: input.merchantOrderId,
        providerReference: providerReference ?? providerTransactionId,
        providerTransactionId,
        paymentUrl,
        vaNumber: pickString(data.vaNumber, data.va_number),
        qrString: pickString(data.qrString, data.qr_string, data.qrisString),
        paymentMethod: this.mapPaymentMethodChannel(input.paymentMethod) ?? input.paymentMethod ?? 'MAYAR_CHECKOUT',
        providerStatus: 'PENDING',
        internalStatus: 'pending',
        raw: body,
      };
    } catch (error) {
      log('error', 'mayar.create_payment_failed', {
        merchantOrderId: input.merchantOrderId,
        error: serializeError(error),
      });
      throw error instanceof ApiError ? error : new ApiError(502, 'Gagal menghubungi gateway pembayaran Mayar.');
    }
  }

  /**
   * Authenticates and parses a Mayar webhook. This only proves the request came
   * from someone holding the webhook token — callers must still confirm a paid
   * status with `checkTransactionStatus` before settling anything.
   */
  async verifyCallback(input: PaymentCallbackInput): Promise<VerifiedPaymentCallback> {
    const body = asRecord(input.body);
    const data = Object.keys(asRecord(body.data)).length > 0 ? asRecord(body.data) : body;
    const extraData = Object.keys(asRecord(data.extraData)).length > 0 ? asRecord(data.extraData) : asRecord(body.extraData);
    const eventType = extractMayarEventName(body);
    const signatureValid = this.verifyWebhookToken({ headers: input.headers, query: input.query, rawBody: input.rawBody, body });

    const orderIdCandidates = uniqueStrings([
      pickString(extraData.merchantOrderId),
      pickString(extraData.orderId),
      pickString(data.merchantOrderId),
      pickString(body.merchantOrderId),
      extractBracketOrderId(data.description),
      extractBracketOrderId(data.productDescription),
      extractBracketOrderId(data.productName),
      extractBracketOrderId(data.name),
    ]);

    // `productId` is the payment request / invoice id that `createPayment` stored as
    // provider_reference. The other ids are kept as lookup fallbacks.
    const providerReference = pickString(data.productId, data.paymentRequestId, data.paymentLinkId, data.invoiceId);
    const providerTransactionId = pickString(data.transactionId, data.transaction_id);
    const referenceCandidates = uniqueStrings([providerReference, providerTransactionId, pickString(data.id)]);

    let rawStatus: string | null = null;
    if (typeof data.status === 'boolean') {
      rawStatus = data.status ? 'PAID' : 'FAILED';
    } else if (pickString(data.status)) {
      rawStatus = pickString(data.status);
    } else if (eventType) {
      rawStatus = eventType;
    }

    let internalStatus: InternalPaymentStatus;
    if (eventType === 'payment.received') {
      const statusMapping = rawStatus && rawStatus !== eventType ? this.mapProviderStatus(rawStatus) : 'paid';
      internalStatus = statusMapping === 'failed' || statusMapping === 'cancelled' || statusMapping === 'expired' ? statusMapping : 'paid';
    } else if (eventType === 'payment.reminder') {
      internalStatus = 'pending';
    } else if (eventType && !MAYAR_PAYMENT_EVENTS.has(eventType)) {
      // membership.*, shipper.status, testing events: not a payment state change.
      internalStatus = 'unknown';
    } else {
      internalStatus = this.mapProviderStatus(rawStatus);
    }

    const amount = parseAmount(data.amount, body.amount);
    const paidAt =
      internalStatus === 'paid'
        ? parseTimestamp(data.paidAt ?? data.updatedAt ?? data.createdAt) ?? new Date().toISOString()
        : null;

    return {
      provider: 'mayar',
      signatureValid,
      eventType,
      merchantOrderId: orderIdCandidates[0] ?? null,
      providerReference: providerReference ?? providerTransactionId ?? pickString(data.id),
      providerTransactionId,
      orderIdCandidates,
      referenceCandidates,
      amount,
      paymentMethod: pickString(data.paymentMethod, data.paymentType, data.paymentChannel) ?? 'MAYAR',
      rawStatus,
      internalStatus,
      paidAt,
      raw: body,
    };
  }

  /**
   * Reads a payment request from Mayar (`GET /hl/v2/payments/{id}`) — the source of
   * truth used to confirm webhooks and manual "cek status" requests.
   */
  async checkTransactionStatus(input: {
    merchantOrderId: string;
    providerReference?: string | null;
    amount?: number | null;
  }): Promise<PaymentStatusResult> {
    const lookupId = input.providerReference?.trim();
    if (!lookupId) {
      throw new ApiError(409, 'Referensi pembayaran Mayar belum tersedia untuk order ini.');
    }
    const prefix = this.resolvePath(env.MAYAR_STATUS_PATH_PREFIX).replace(/\/+$/, '');
    let response: MayarResponse;
    try {
      response = await this.request('GET', `${prefix}/${encodeURIComponent(lookupId)}`);
    } catch (error) {
      log('warn', 'mayar.check_status_unreachable', { merchantOrderId: input.merchantOrderId, error: serializeError(error) });
      throw error instanceof ApiError ? error : new ApiError(502, 'Gagal menghubungi Mayar untuk cek status pembayaran.');
    }
    const { status, ok, body } = response;
    if (status === 404) {
      throw new ApiError(404, 'Pembayaran tidak ditemukan di Mayar.');
    }
    if (!ok) {
      log('warn', 'mayar.check_status_failed', { status, merchantOrderId: input.merchantOrderId, message: extractMayarMessage(body) });
      throw new ApiError(502, `Mayar check status gagal (${status}).`);
    }

    const data = asRecord(body.data ?? body);
    const extraData = asRecord(data.extraData);
    const transactions = Array.isArray(data.transactions) ? data.transactions.map(asRecord) : [];
    const paidTransaction = transactions.find((entry) => this.mapProviderStatus(entry.status) === 'paid');

    let rawStatus = pickString(data.status, body.status);
    let internalStatus = this.mapProviderStatus(rawStatus);
    if (internalStatus !== 'paid' && paidTransaction) {
      rawStatus = pickString(paidTransaction.status) ?? 'paid';
      internalStatus = 'paid';
    }

    const merchantOrderId =
      pickString(extraData.merchantOrderId, extraData.orderId) ??
      extractBracketOrderId(data.description) ??
      extractBracketOrderId(data.name) ??
      null;

    return {
      provider: 'mayar',
      signatureValid: true,
      eventType: 'status_check',
      merchantOrderId: merchantOrderId ?? input.merchantOrderId,
      providerReference: pickString(data.id) ?? lookupId,
      providerTransactionId: pickString(paidTransaction?.id, data.transactionId),
      orderIdCandidates: uniqueStrings([merchantOrderId]),
      referenceCandidates: uniqueStrings([pickString(data.id), lookupId]),
      amount: parseAmount(data.amount, paidTransaction?.amount, input.amount),
      paymentMethod: pickString(paidTransaction?.paymentMethod, data.paymentMethod) ?? 'MAYAR',
      rawStatus,
      internalStatus,
      paidAt:
        internalStatus === 'paid'
          ? parseTimestamp(paidTransaction?.updatedAt ?? paidTransaction?.createdAt ?? data.updatedAt) ?? new Date().toISOString()
          : null,
      raw: body,
    };
  }

  mapProviderStatus(rawStatus: unknown): InternalPaymentStatus {
    if (rawStatus === true) return 'paid';
    if (rawStatus === false) return 'failed';
    const normalized = String(rawStatus ?? '').trim().toLowerCase();
    if (!normalized) return 'unknown';
    if (PAID_STATUSES.has(normalized)) return 'paid';
    if (PENDING_STATUSES.has(normalized)) return 'pending';
    if (normalized === 'expired' || normalized === 'expire') return 'expired';
    if (CANCELLED_STATUSES.has(normalized)) return 'cancelled';
    if (normalized === 'refunded' || normalized === 'refund') return 'refunded';
    if (FAILED_STATUSES.has(normalized)) return 'failed';
    return 'unknown';
  }
}
