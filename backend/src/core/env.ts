/**
 * Environment configuration — parsed and validated with Zod.
 * Single source of truth for all backend env vars.
 */
import { z } from 'zod';

/**
 * Deprecation notes collected while parsing env (e.g. a deployment that still says
 * PAYMENT_GATEWAY_PROVIDER=doku). Surfaced in /api/admin/system-status warnings.
 */
export const envDeprecations: string[] = [];

/** Payment gateways that were removed; deployments still pointing at them now use Mayar. */
const LEGACY_GATEWAYS = new Set(['doku', 'duitku', 'midtrans']);

const paymentGatewayProviderSchema = z.preprocess((value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;
  if (typeof normalized === 'string' && LEGACY_GATEWAYS.has(normalized)) {
    envDeprecations.push(
      `PAYMENT_GATEWAY_PROVIDER=${normalized} sudah tidak didukung; backend memakai Mayar. Ubah env ke PAYMENT_GATEWAY_PROVIDER=mayar.`,
    );
    return 'mayar';
  }
  return normalized === '' ? undefined : normalized;
}, z.enum(['mayar', 'disabled']).default('mayar'));

const subscriptionPaymentModeSchema = z.preprocess((value) => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;
  if (typeof normalized === 'string') {
    const legacy = normalized.match(/^(doku|duitku|midtrans)_(sandbox|production)$/);
    if (legacy) {
      envDeprecations.push(
        `SUBSCRIPTION_PAYMENT_MODE=${normalized} sudah tidak didukung; dibaca sebagai mayar_${legacy[2]}.`,
      );
      return `mayar_${legacy[2]}`;
    }
  }
  return normalized === '' ? undefined : normalized;
}, z.enum(['auto', 'manual', 'disabled', 'mayar_sandbox', 'mayar_production']).default('auto'));

export const envSchema = z.object({
  SERVICE_NAME: z.string().trim().default('kaffepos-backend'),
  APP_VERSION: z.string().trim().default('1.0.0'),
  MIN_SUPPORTED_WEB_VERSION: z.string().trim().default('0.0.0'),
  MIN_SUPPORTED_APK_VERSION: z.string().trim().default('0.0.0'),
  APP_RELEASE_CHANNEL: z.enum(['development', 'beta', 'stable']).default('beta'),
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  STAGING_PROFILE: z.string().trim().optional(),
  PORT: z.coerce.number().int().positive().default(8787),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  INSFORGE_PROJECT_ID: z.string().trim().optional(),
  INSFORGE_URL: z.string().trim().url().optional(),
  INSFORGE_ANON_KEY: z.string().trim().optional(),
  INSFORGE_API_KEY: z.string().trim().optional(),
  DATABASE_URL: z.string().trim().optional(),
  DB_HOST: z.string().trim().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().trim().default('kaffepos_production'),
  DB_USER: z.string().trim().default('kaffepos'),
  DB_PASSWORD: z.string().trim().optional(),
  DB_SSL: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .default('false'),
  DB_SSL_REJECT_UNAUTHORIZED: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .default('true'),
  DB_SSL_CA: z.string().optional(),
  // PII (affiliate payout/bank) encryption key. If unset, the key derives from
  // DATABASE_URL — so changing the DB password rotates the PII key too. Pin this
  // to a stable value before rotating DB creds to keep existing data decryptable.
  PII_ENCRYPTION_KEY: z.string().trim().optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  EMAIL_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(60),
  WEB_BASE_URL: z.string().trim().url().default('https://kaffepos.my.id'),
  API_BASE_URL: z.string().trim().url().default('https://api.kaffepos.my.id'),
  CLOUDFLARE_ACCOUNT_ID: z.string().trim().optional(),
  CLOUDFLARE_R2_BUCKET: z.string().trim().optional(),
  CLOUDFLARE_R2_PUBLIC_URL: z.string().trim().url().optional(),
  CLOUDFLARE_IMAGES_ACCOUNT_HASH: z.string().trim().optional(),
  CLOUDFLARE_IMAGES_DELIVERY_URL: z.string().trim().url().optional(),
  RESEND_API_KEY: z.string().trim().optional(),
  RESEND_FROM_EMAIL: z.string().trim().optional(),
  // Payment gateway: Mayar is the only online gateway. `disabled` turns online payment off.
  PAYMENT_GATEWAY_PROVIDER: paymentGatewayProviderSchema,
  PAYMENT_INTEGRATION_ENABLED: z.union([z.literal('true'), z.literal('false')]).optional().default('true'),
  // Mayar Headless API v2 — https://docs.mayar.id/api-reference-v2/introduction
  //   production: https://api.mayar.id/hl/v2  (key: https://web.mayar.id/api-keys)
  //   sandbox:    https://api.mayar.io/hl/v2  (key: https://web.mayar.io/api-keys)
  // Older sandbox accounts created on web.mayar.club use MAYAR_SANDBOX_BASE_URL=https://api.mayar.club.
  MAYAR_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
  // Bearer API key for create-payment and status-check calls. Backend-only secret.
  MAYAR_API_KEY: z.string().trim().optional(),
  // "Web Token" from the Mayar dashboard; Mayar sends it as X-Callback-Token (?token= on the URL also works).
  MAYAR_WEBHOOK_TOKEN: z.string().trim().optional(),
  MAYAR_SANDBOX_BASE_URL: z.string().trim().url().default('https://api.mayar.io'),
  MAYAR_PRODUCTION_BASE_URL: z.string().trim().url().default('https://api.mayar.id'),
  MAYAR_CREATE_PAYMENT_PATH: z.string().trim().default('/hl/v2/payments/create'),
  MAYAR_STATUS_PATH_PREFIX: z.string().trim().default('/hl/v2/payments'),
  MAYAR_WEBHOOK_PATH: z.string().trim().default('/api/webhooks/mayar'),
  // Where Mayar sends the customer after paying a subscription (optional).
  MAYAR_REDIRECT_URL: z.string().trim().url().optional(),
  // Public webhook URL registered in Mayar (defaults to API_BASE_URL + MAYAR_WEBHOOK_PATH).
  MAYAR_CALLBACK_URL: z.string().trim().url().optional(),
  MAYAR_PAYMENT_DUE_MINUTES: z.coerce.number().int().positive().default(60),
  SUBSCRIPTION_PAYMENT_MODE: subscriptionPaymentModeSchema,
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  AUTH_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  AUTH_EMAIL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  AUTH_VERIFY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  PAYMENT_CREATE_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(12),
  AFFILIATE_REFERRAL_ENABLED: z.union([z.literal('true'), z.literal('false')]).optional().default('false'),
  REFERRAL_ENABLED: z.union([z.literal('true'), z.literal('false')]).optional().default('false'),
  AFFILIATE_ENABLED: z.union([z.literal('true'), z.literal('false')]).optional().default('false'),
  ADMIN_COMMISSION_ENABLED: z.union([z.literal('true'), z.literal('false')]).optional().default('false'),
  REFERRAL_COMMISSION_CREATION_ENABLED: z.union([z.literal('true'), z.literal('false')]).optional().default('false'),
  GEMINI_API_KEY: z.string().trim().optional(),
  CORS_ORIGIN: z.string().trim().optional(),
  ADMIN_EMAILS: z.string().trim().optional(),
  STAGING_REPAIR_TOKEN: z.string().trim().optional(),
  SENTRY_DSN: z.string().trim().optional(),
  SENTRY_ENVIRONMENT: z.string().trim().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.string().trim().optional(),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);

for (const note of envDeprecations) {
  console.warn(`[env] ${note}`);
}

// In production, ADMIN_EMAILS must be set explicitly — a hardcoded fallback would
// hand admin access to whoever controls that address if the env var is ever missing.
const adminEmailsRaw =
  env.ADMIN_EMAILS || (env.NODE_ENV === 'production' ? '' : 'kaffeposapp@gmail.com');
if (env.NODE_ENV === 'production' && !adminEmailsRaw) {
  throw new Error('ADMIN_EMAILS env var must be set in production');
}
export const adminEmails = new Set(
  adminEmailsRaw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
