export type PaymentProviderName = 'mayar' | 'disabled';
export type InternalPaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'cancelled' | 'refunded' | 'unknown';

export type CreatePaymentInput = {
  merchantOrderId: string;
  amount: number;
  productDetails: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  paymentMethod?: string | null;
  returnUrl?: string | null;
  itemDetails?: Array<{ name: string; price: number; quantity: number }>;
  customerDetail?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type CreatePaymentResult = {
  provider: PaymentProviderName;
  merchantOrderId: string;
  providerReference: string | null;
  /** Gateway-side transaction id (Mayar returns it next to the payment request id). */
  providerTransactionId?: string | null;
  paymentUrl: string | null;
  vaNumber: string | null;
  qrString: string | null;
  paymentMethod: string | null;
  providerStatus: string | null;
  internalStatus: InternalPaymentStatus;
  raw: Record<string, unknown>;
};

export type VerifiedPaymentCallback = {
  provider: PaymentProviderName;
  /** True when the webhook token / signature matched. */
  signatureValid: boolean;
  merchantOrderId: string | null;
  providerReference: string | null;
  providerTransactionId?: string | null;
  /** Webhook event name as sent by the gateway (e.g. `payment.received`). */
  eventType?: string | null;
  /** Every id in the payload that may match `merchant_order_id` (our order ids). */
  orderIdCandidates?: string[];
  /** Every id in the payload that may match `provider_reference` (gateway ids). */
  referenceCandidates?: string[];
  amount: number | null;
  paymentMethod: string | null;
  rawStatus: string | null;
  internalStatus: InternalPaymentStatus;
  paidAt: string | null;
  raw: Record<string, unknown>;
};

export type PaymentStatusResult = VerifiedPaymentCallback;

export type PaymentCallbackInput = {
  body: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
  rawBody?: string;
  /** Parsed query string of the webhook request (Mayar URL-token mode: `?token=`). */
  query?: Record<string, unknown>;
};

export interface PaymentProvider {
  providerName: PaymentProviderName;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyCallback(input: PaymentCallbackInput): Promise<VerifiedPaymentCallback>;
  checkTransactionStatus(input: { merchantOrderId: string; providerReference?: string | null; amount?: number | null }): Promise<PaymentStatusResult>;
  mapProviderStatus(rawStatus: unknown): InternalPaymentStatus;
}
