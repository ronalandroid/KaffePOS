import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApiError, env, log, serializeError } from '../../core';
import { mayarCircuitBreaker } from '../../architecture/circuitBreaker';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  InternalPaymentStatus,
  PaymentProvider,
  PaymentStatusResult,
  VerifiedPaymentCallback,
} from '../payment-provider.types';

function readHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string,
): string {
  if (!headers) return '';
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return (Array.isArray(value) ? value[0] : value ?? '').trim();
    }
  }
  return '';
}

function safeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function normalizePhone(phone?: string | null): string {
  const cleaned = (phone ?? '').replace(/[^\d+]/g, '').trim();
  return cleaned.length >= 8 ? cleaned : '081234567890';
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
    const parsed = Date.parse(value.trim());
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  }
  return null;
}

export class MayarPaymentProvider implements PaymentProvider {
  readonly providerName = 'mayar' as const;

  private get apiKey() {
    if (!env.MAYAR_API_KEY) {
      throw new ApiError(503, 'Mayar API key belum dikonfigurasi.');
    }
    return env.MAYAR_API_KEY;
  }

  private get webhookSecret() {
    const secret = env.MAYAR_WEBHOOK_TOKEN || env.MAYAR_API_KEY;
    if (!secret) {
      throw new ApiError(503, 'Mayar webhook token / API key belum dikonfigurasi.');
    }
    return secret;
  }

  private get baseUrl() {
    const base =
      env.MAYAR_ENVIRONMENT === 'production'
        ? env.MAYAR_PRODUCTION_BASE_URL
        : env.MAYAR_SANDBOX_BASE_URL;
    return base.replace(/\/$/, '');
  }

  private mapPaymentMethodChannel(method?: string | null): string | undefined {
    const normalized = (method ?? '').trim().toLowerCase();
    if (!normalized) return undefined;
    if (normalized === 'qris') return 'qris';
    if (normalized === 'bni_va' || normalized === 'va/bni') return 'va/bni';
    if (normalized === 'bri_va' || normalized === 'va/bri') return 'va/bri';
    if (normalized === 'mandiri_bill' || normalized === 'va/mandiri') return 'va/mandiri';
    if (normalized === 'cimb_va' || normalized === 'va/cimb') return 'va/cimb';
    if (normalized === 'permata_va' || normalized === 'va/permata') return 'va/permata';
    if (normalized === 'bsi_va' || normalized === 'va/bsi') return 'va/bsi';
    return undefined;
  }

  verifyWebhookSignature(params: {
    headers?: Record<string, string | string[] | undefined>;
    rawBody?: string;
    body: Record<string, unknown>;
  }): boolean {
    let secret = '';
    try {
      secret = this.webhookSecret;
    } catch {
      return false;
    }

    const bearerRaw = readHeader(params.headers, 'authorization');
    const bearerToken = bearerRaw.toLowerCase().startsWith('bearer ')
      ? bearerRaw.slice(7).trim()
      : bearerRaw;

    const candidates = [
      readHeader(params.headers, 'x-callback-token'),
      readHeader(params.headers, 'x-mayar-token'),
      readHeader(params.headers, 'x-webhook-token'),
      readHeader(params.headers, 'x-mayar-signature'),
      readHeader(params.headers, 'signature'),
      bearerToken,
      typeof params.body.webhookToken === 'string' ? params.body.webhookToken.trim() : '',
    ].filter(Boolean);

    if (candidates.length === 0) return false;

    const rawBody = params.rawBody ?? JSON.stringify(params.body);
    const hmacHex = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
    const hmacBase64 = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');

    for (const candidate of candidates) {
      if (
        safeCompare(candidate, secret) ||
        safeCompare(candidate, hmacHex) ||
        safeCompare(candidate, hmacBase64) ||
        safeCompare(candidate, `HMACSHA256=${hmacBase64}`) ||
        (env.MAYAR_API_KEY && safeCompare(candidate, env.MAYAR_API_KEY))
      ) {
        return true;
      }
    }

    return false;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new ApiError(400, 'Nominal pembayaran tidak valid.');
    }

    const amount = Math.round(input.amount);
    const expiredAt = new Date(
      Date.now() + env.MAYAR_PAYMENT_DUE_MINUTES * 60_000,
    ).toISOString();
    const redirectUrl = input.returnUrl ?? env.MAYAR_REDIRECT_URL ?? undefined;
    const isInvoiceEndpoint = env.MAYAR_CREATE_PAYMENT_PATH.includes('/invoices/');

    const basePayload: Record<string, unknown> = {
      name: (input.customerName || input.productDetails || input.merchantOrderId).slice(0, 100),
      amount,
      email: input.customerEmail || 'customer@kaffepos.my.id',
      mobile: normalizePhone(input.customerPhone),
      description: `${(input.productDetails || input.merchantOrderId).slice(0, 180)} [${input.merchantOrderId}]`,
      expiredAt,
      ...(redirectUrl ? { redirectUrl } : {}),
      extraData: {
        merchantOrderId: input.merchantOrderId,
        orderId: input.merchantOrderId,
        ...(input.metadata ?? {}),
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
                : [
                    {
                      description: (input.productDetails || input.merchantOrderId).slice(0, 100),
                      rate: amount,
                      quantity: 1,
                    },
                  ],
          }
        : {}),
    };

    const targetPath = env.MAYAR_CREATE_PAYMENT_PATH.startsWith('/')
      ? env.MAYAR_CREATE_PAYMENT_PATH
      : `/${env.MAYAR_CREATE_PAYMENT_PATH}`;
    const url = `${this.baseUrl}${targetPath}`;

    const sendCreateRequest = async (payloadObj: Record<string, unknown>) => {
      return mayarCircuitBreaker.execute(async () => {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payloadObj),
          signal: AbortSignal.timeout(15_000),
        });
        const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        return { response, body };
      });
    };

    try {
      log('info', 'mayar.create_payment_request', {
        environment: env.MAYAR_ENVIRONMENT,
        baseUrl: this.baseUrl,
        target: targetPath,
        merchantOrderId: input.merchantOrderId,
        amount,
        redirectUrlConfigured: Boolean(redirectUrl),
      });

      let { response, body } = await sendCreateRequest(basePayload);

      // Mayar /hl/v2/payments/create rejects redirectUrl with 400 if the account/record
      // does not persist redirectUrl; retry cleanly without redirectUrl when that happens.
      if (
        !response.ok &&
        response.status === 400 &&
        redirectUrl &&
        typeof body.messages === 'string' &&
        body.messages.toLowerCase().includes('redirecturl')
      ) {
        const retryPayload = { ...basePayload };
        delete retryPayload.redirectUrl;
        ({ response, body } = await sendCreateRequest(retryPayload));
      }

      const data = (body.data ?? body) as Record<string, unknown>;
      const paymentUrl =
        typeof data.link === 'string'
          ? data.link
          : typeof data.linkPayment === 'string'
          ? data.linkPayment
          : typeof data.paymentUrl === 'string'
          ? data.paymentUrl
          : typeof data.linkUrl === 'string'
          ? data.linkUrl
          : null;
      const providerReference =
        typeof data.id === 'string'
          ? data.id
          : typeof data.transactionId === 'string'
          ? data.transactionId
          : null;

      log(response.ok ? 'info' : 'warn', 'mayar.create_payment_response', {
        environment: env.MAYAR_ENVIRONMENT,
        status: response.status,
        merchantOrderId: input.merchantOrderId,
        hasPaymentUrl: Boolean(paymentUrl),
        providerReference,
        message: typeof body.messages === 'string' ? body.messages : null,
      });

      if (!response.ok) {
        throw new ApiError(502, `Mayar create payment gagal (${response.status}).`);
      }
      if (!paymentUrl) {
        throw new ApiError(502, 'Mayar create payment tidak mengembalikan link pembayaran.');
      }

      return {
        provider: 'mayar',
        merchantOrderId: input.merchantOrderId,
        providerReference,
        paymentUrl,
        vaNumber: typeof data.vaNumber === 'string' ? data.vaNumber : null,
        qrString: typeof data.qrString === 'string' ? data.qrString : null,
        paymentMethod: this.mapPaymentMethodChannel(input.paymentMethod) ?? input.paymentMethod ?? 'MAYAR_CHECKOUT',
        providerStatus: typeof body.messages === 'string' ? body.messages : 'PENDING',
        internalStatus: 'pending',
        raw: body,
      };
    } catch (error) {
      log('error', 'mayar.create_payment_failed', {
        merchantOrderId: input.merchantOrderId,
        error: serializeError(error),
      });
      throw error instanceof ApiError
        ? error
        : new ApiError(502, 'Gagal menghubungi gateway pembayaran Mayar.');
    }
  }

  async verifyCallback(input: {
    body: Record<string, unknown>;
    headers?: Record<string, string | string[] | undefined>;
    rawBody?: string;
  }): Promise<VerifiedPaymentCallback> {
    const body = input.body ?? {};
    const data = ((body.data && typeof body.data === 'object' ? body.data : body) ?? {}) as Record<
      string,
      unknown
    >;
    const extraData = ((data.extraData && typeof data.extraData === 'object'
      ? data.extraData
      : body.extraData && typeof body.extraData === 'object'
      ? body.extraData
      : {}) ?? {}) as Record<string, unknown>;

    const eventObj = body.event && typeof body.event === 'object' ? (body.event as Record<string, unknown>) : null;
    const eventName =
      typeof body.event === 'string'
        ? body.event
        : typeof eventObj?.received === 'string'
        ? eventObj.received
        : null;

    const signatureValid = this.verifyWebhookSignature({
      headers: input.headers,
      rawBody: input.rawBody,
      body,
    });

    const explicitOrderId =
      typeof extraData.merchantOrderId === 'string'
        ? extraData.merchantOrderId
        : typeof extraData.orderId === 'string'
        ? extraData.orderId
        : typeof data.merchantOrderId === 'string'
        ? data.merchantOrderId
        : typeof body.merchantOrderId === 'string'
        ? body.merchantOrderId
        : extractBracketOrderId(data.productName) ??
          extractBracketOrderId(data.description) ??
          extractBracketOrderId(data.name);

    const providerReference =
      typeof data.productId === 'string'
        ? data.productId
        : typeof data.paymentLinkId === 'string'
        ? data.paymentLinkId
        : typeof data.invoiceId === 'string'
        ? data.invoiceId
        : typeof data.id === 'string'
        ? data.id
        : typeof data.transactionId === 'string'
        ? data.transactionId
        : null;

    const merchantOrderId = explicitOrderId ?? providerReference;

    let rawStatus: string | null = null;
    if (typeof data.status === 'boolean') {
      rawStatus = data.status ? 'PAID' : 'FAILED';
    } else if (typeof data.status === 'string' && data.status.trim()) {
      rawStatus = data.status.trim();
    } else if (typeof data.transactionStatus === 'string' && data.transactionStatus.trim()) {
      rawStatus = data.transactionStatus.trim();
    } else if (eventName) {
      rawStatus = eventName;
    }

    const internalStatus =
      eventName === 'payment.received' && data.status !== false
        ? 'paid'
        : this.mapProviderStatus(rawStatus);

    const amountRaw = Number(data.amount ?? body.amount ?? NaN);
    const amount = Number.isFinite(amountRaw) ? Math.round(amountRaw) : null;
    const paymentMethod =
      typeof data.paymentMethod === 'string'
        ? data.paymentMethod
        : typeof data.paymentType === 'string'
        ? data.paymentType
        : 'MAYAR';
    const paidAt =
      internalStatus === 'paid'
        ? parseTimestamp(data.paidAt ?? data.updatedAt ?? data.createdAt) ?? new Date().toISOString()
        : null;

    return {
      provider: 'mayar',
      signatureValid,
      merchantOrderId,
      providerReference,
      amount,
      paymentMethod,
      rawStatus,
      internalStatus,
      paidAt,
      raw: body,
    };
  }

  async checkTransactionStatus(input: {
    merchantOrderId: string;
    providerReference?: string | null;
    amount?: number | null;
  }): Promise<PaymentStatusResult> {
    const lookupId = input.providerReference?.trim() || input.merchantOrderId;
    const prefix = env.MAYAR_STATUS_PATH_PREFIX.replace(/\/$/, '');
    const targetPath = `${prefix.startsWith('/') ? prefix : `/${prefix}`}/${encodeURIComponent(lookupId)}`;
    const { body } = await mayarCircuitBreaker.execute(async () => {
      const res = await fetch(`${this.baseUrl}${targetPath}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        throw new ApiError(502, `Mayar check status gagal (${res.status}).`);
      }
      const parsed = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { response: res, body: parsed };
    });

    const data = ((body.data && typeof body.data === 'object' ? body.data : body) ?? {}) as Record<
      string,
      unknown
    >;
    const extraData = ((data.extraData && typeof data.extraData === 'object' ? data.extraData : {}) ??
      {}) as Record<string, unknown>;
    const rawStatus =
      typeof data.status === 'string'
        ? data.status
        : typeof body.status === 'string'
        ? body.status
        : null;
    const internalStatus = this.mapProviderStatus(rawStatus);
    const amountRaw = Number(data.amount ?? input.amount ?? NaN);
    const merchantOrderId =
      (typeof extraData.merchantOrderId === 'string' ? extraData.merchantOrderId : null) ??
      extractBracketOrderId(data.description) ??
      extractBracketOrderId(data.name) ??
      input.merchantOrderId;
    const providerReference =
      typeof data.id === 'string'
        ? data.id
        : typeof data.transactionId === 'string'
        ? data.transactionId
        : input.providerReference ?? null;

    return {
      provider: 'mayar',
      signatureValid: true,
      merchantOrderId,
      providerReference,
      amount: Number.isFinite(amountRaw) ? Math.round(amountRaw) : null,
      paymentMethod: typeof data.paymentMethod === 'string' ? data.paymentMethod : 'MAYAR',
      rawStatus,
      internalStatus,
      paidAt: internalStatus === 'paid' ? new Date().toISOString() : null,
      raw: body,
    };
  }

  mapProviderStatus(rawStatus: unknown): InternalPaymentStatus {
    if (rawStatus === true) return 'paid';
    if (rawStatus === false) return 'failed';
    const normalized = String(rawStatus ?? '').trim().toLowerCase();
    if (
      normalized === 'paid' ||
      normalized === 'settled' ||
      normalized === 'settlement' ||
      normalized === 'success' ||
      normalized === 'completed' ||
      normalized === 'true' ||
      normalized === 'payment.received'
    ) {
      return 'paid';
    }
    if (
      normalized === 'unpaid' ||
      normalized === 'pending' ||
      normalized === 'created' ||
      normalized === 'active' ||
      normalized === 'waiting' ||
      normalized === 'open' ||
      normalized === 'payment.reminder'
    ) {
      return 'pending';
    }
    if (normalized === 'expired' || normalized === 'expire') return 'expired';
    if (
      normalized === 'closed' ||
      normalized === 'cancelled' ||
      normalized === 'canceled' ||
      normalized === 'cancel' ||
      normalized === 'void'
    ) {
      return 'cancelled';
    }
    if (normalized === 'refunded' || normalized === 'refund') return 'refunded';
    if (
      normalized === 'failed' ||
      normalized === 'failure' ||
      normalized === 'deny' ||
      normalized === 'rejected' ||
      normalized === 'false'
    ) {
      return 'failed';
    }
    return 'unknown';
  }
}
