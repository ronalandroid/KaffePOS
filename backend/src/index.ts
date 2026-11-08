import 'dotenv/config';

import healthRouter, { setHealthRuntimeState } from './routes/health';
import authRouter from './routes/auth';
import storesRouter from './routes/stores';
import menuRouter from './routes/menu';
import inventoryRouter from './routes/inventory';
import financeRouter from './routes/finance';
import kitchenRouter from './routes/kitchen';
import transactionsRouter from './routes/transactions';
import fnbRouter from './routes/fnb';
import loyaltyRouter from './routes/loyalty';
import challengesRouter from './routes/challenges';
import subscriptionsRouter from './routes/subscriptions';
import paymentRouter from './routes/payment';
import adminRouter from './routes/admin';
import miscRouter from './routes/misc';
import importLocalStorageRouter from './routes/importLocalStorage';
import webhooksRouter from './routes/webhooks';
import metricsRouter from './routes/metrics';
import stagingRouter from './routes/staging';
import { appVersionAuthenticatedRouter, appVersionPublicRouter } from './routes/appVersion';
import referralsRouter from './routes/referrals';
import affiliateRouter from './routes/affiliate';
import adminMfaRouter from './routes/admin-mfa';
import { securityHeaders } from './middleware/securityHeaders';
import { compression } from './middleware/compression';
import { initEmailJobs } from './lib/emailJobs';
import { jobQueue } from './lib/jobQueue';

import { handleAnalyticsJob, handleCommissionJob, handleEmailJob, handleNotificationJob } from './lib/jobQueueHandlers';

import { createHash } from 'node:crypto';
import { type Server } from 'node:http';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { buildAllowedCorsOrigins, isOriginAllowed } from './lib/corsOrigins';
import { env } from './core/env';
import { resolveSubscriptionPaymentConfig, isActivePaymentGatewayConfigured } from './core/billing';
import { pool } from './core/db';
import { bootstrapAllSchemas } from './schema-bootstrap';
import { ApiError, log, serializeError } from './core/errors';
import { initBackendErrorTracking } from './core/errorTracking';
import {
  getPermissionsForRole,
  normalizeUserRole,
  type Permission,
  type UserRole,
} from './lib/accessControl';
import {
  canCashierLogin,
  normalizeCashierStatus,
} from './lib/cashierManagement';

import {
  errorLoggingMiddleware,
  installDatabaseApm,
  requestContextMiddleware,
  requestLoggingMiddleware,
  startApmMonitoring,
} from './middleware/apm';
import { microserviceGatewayMiddleware } from './architecture/serviceRegistry';
import { errorHandler } from './core/errorHandler';

type AuthenticatedUser = {
  id: string;
  email: string | null;
  email_verified_at?: string | null;
  created_at?: string | null;
  role: UserRole;
  permissions: Permission[];
  account_status?: string | null;
};

type AuthenticatedSession = {
  id: string;
  tokenHash: string;
  expiresAt: string;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
      authSession?: AuthenticatedSession;
      requestId?: string;
      rawBody?: string;
    }
  }
}

const serviceStartedAt = Date.now();
let isShuttingDown = false;
let server: Server | null = null;

const allowedOrigins = buildAllowedCorsOrigins(env.CORS_ORIGIN);

const app = express();
app.use(securityHeaders);
initBackendErrorTracking();
initEmailJobs();
installDatabaseApm(pool);
startApmMonitoring();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({
  limit: '1mb',
  // Preserve the raw payload so header-signature webhooks (DOKU) can verify the
  // exact bytes the provider hashed into its Digest.
  verify: (req, _res, buf) => {
    (req as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(compression);
app.use(requestContextMiddleware());
app.use(microserviceGatewayMiddleware());
app.use(requestLoggingMiddleware());

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowedOrigins)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed`));
    },
    credentials: true,
  }),
);

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}, Math.min(env.AUTH_RATE_LIMIT_WINDOW_MS, 60_000)).unref();

function getBearerToken(req: Request) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      throw new ApiError(401, 'Missing bearer token.');
    }

    const tokenHash = hashToken(token);
    const result = await pool.query(
      `
        select
          s.id as session_id,
          s.expires_at,
          c.user_id,
          c.email,
          c.email_verified_at,
          p.role,
          p.account_status,
          exists (
            select 1
            from public.cashier_outlet_assignments a
            where a.cashier_id = c.user_id
              and a.status = 'active'
          ) as has_active_assignment
        from public.app_auth_sessions s
        join public.app_auth_credentials c on c.user_id = s.user_id
        left join public.profiles p on p.id = c.user_id
        where s.token_hash = $1
          and s.revoked_at is null
          and s.expires_at > now()
        limit 1
      `,
      [tokenHash],
    );

    const session = result.rows[0];
    if (!session) {
      throw new ApiError(401, 'Sesi tidak valid atau sudah kedaluwarsa.');
    }

    const role = normalizeUserRole(session.role);
    const accountStatus = normalizeCashierStatus(session.account_status);
    if (role === 'cashier' && !canCashierLogin(accountStatus)) {
      throw new ApiError(403, 'Akun kasir nonaktif. Hubungi Owner/Admin.');
    }
    if (role === 'cashier' && !session.has_active_assignment) {
      throw new ApiError(403, 'Akun kasir belum terhubung ke outlet aktif.');
    }

    req.authUser = {
      id: session.user_id as string,
      email: (session.email as string | null) ?? null,
      email_verified_at: (session.email_verified_at as string | null) ?? null,
      role,
      permissions: getPermissionsForRole(role),
      account_status: accountStatus,
    };
    req.authSession = {
      id: session.session_id as string,
      tokenHash,
      expiresAt: session.expires_at as string,
    };

    void pool.query(
      `
        update public.app_auth_sessions
        set last_seen_at = now()
        where id = $1
      `,
      [session.session_id],
    ).catch(() => {});

    next();
  } catch (error) {
    next(error);
  }
}


// ── Modular routes ─────────────────────────────────────────────
// Health, system-status → extracted to routes/health.ts
setHealthRuntimeState({ serviceStartedAt, isShuttingDown: () => isShuttingDown });
app.use(healthRouter);
app.use(appVersionPublicRouter);
app.use(metricsRouter);

app.use(referralsRouter);
// Pre-auth webhook routes
app.use(webhooksRouter);

// Auth, profile → extracted to routes/auth.ts
app.use(authRouter);
// Defense-in-depth: the staging repair endpoints already gate on NODE_ENV at request
// time, but never register the routes at all outside non-production environments.
if (env.NODE_ENV !== 'production') {
  app.use(stagingRouter);
}

function rewriteApiV1Request(req: Request, _res: Response, next: NextFunction) {
  req.url = `/api${req.url}`;
  next();
}

app.use('/api/v1', rewriteApiV1Request, webhooksRouter, authRouter);
app.use(
  '/api/v1',
  authenticate,
  rewriteApiV1Request,
  storesRouter,
  menuRouter,
  inventoryRouter,
  financeRouter,
  kitchenRouter,
  transactionsRouter,
  fnbRouter,
  loyaltyRouter,
  challengesRouter,
  subscriptionsRouter,
  paymentRouter,
  adminMfaRouter,
  adminRouter,
  appVersionAuthenticatedRouter,
  miscRouter,
);

app.use('/api', authenticate);

// Stores, cashiers, menu, inventory, finance → extracted to route modules
app.use(storesRouter);
app.use(menuRouter);
app.use(inventoryRouter);
app.use(financeRouter);
app.use(kitchenRouter);
app.use(transactionsRouter);
app.use(fnbRouter);
app.use(loyaltyRouter);
app.use(challengesRouter);
app.use(subscriptionsRouter);
app.use(paymentRouter);
app.use(affiliateRouter);
app.use(adminMfaRouter);
app.use(adminRouter);
app.use(appVersionAuthenticatedRouter);
app.use(miscRouter);
app.use(importLocalStorageRouter);

app.use(errorLoggingMiddleware);

// Centralized error handler (structured { error: { code, message } } responses + Sentry).
app.use(errorHandler);

async function verifyDependenciesOnStartup() {
  const startedAt = Date.now();
  await bootstrapAllSchemas();
  await pool.query('select 1');
  log('info', 'startup.dependencies_ready', {
    database: {
      ok: true,
      latencyMs: Date.now() - startedAt,
    },
    email: {
      ok: Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL),
      provider: 'resend',
    },
    payment: {
      ok: isActivePaymentGatewayConfigured(),
      provider: resolveSubscriptionPaymentConfig().provider,
      environment: resolveSubscriptionPaymentConfig().environment,
      mode: resolveSubscriptionPaymentConfig().mode,
    },
  });
}

async function shutdown(signal: NodeJS.Signals | 'FATAL') {
  jobQueue.stop();
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('warn', 'shutdown.started', { signal });

  const forcedExitTimer = setTimeout(() => {
    log('error', 'shutdown.force_exit', { signal });
    process.exit(1);
  }, 10_000);
  forcedExitTimer.unref();

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }

    await pool.end();
    clearTimeout(forcedExitTimer);
    log('info', 'shutdown.completed', { signal });
    process.exit(signal === 'FATAL' ? 1 : 0);
  } catch (error) {
    clearTimeout(forcedExitTimer);
    log('error', 'shutdown.failed', {
      signal,
      error: serializeError(error),
    });
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
  log('error', 'process.unhandled_rejection', { error: serializeError(reason) });
  void shutdown('FATAL');
});

process.on('uncaughtException', (error) => {
  log('error', 'process.uncaught_exception', { error: serializeError(error) });
  void shutdown('FATAL');
});

async function start() {
  jobQueue.registerHandler('email', handleEmailJob);
  jobQueue.registerHandler('analytics', handleAnalyticsJob);
  jobQueue.registerHandler('notification', handleNotificationJob);
  jobQueue.registerHandler('commission', handleCommissionJob);
  jobQueue.start();
  log('info', 'startup.boot', {
    port: env.PORT,
    env: env.NODE_ENV,
    corsOrigins: Array.from(allowedOrigins),
    databaseTarget: env.DATABASE_URL ? 'DATABASE_URL' : `${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`,
    webBaseUrl: env.WEB_BASE_URL,
    apiBaseUrl: env.API_BASE_URL,
    emailProvider: env.RESEND_API_KEY && env.RESEND_FROM_EMAIL ? 'resend' : 'disabled',
    paymentProvider: isActivePaymentGatewayConfigured() ? resolveSubscriptionPaymentConfig().provider : 'disabled',
    paymentEnvironment: resolveSubscriptionPaymentConfig().environment,
    subscriptionPaymentMode: resolveSubscriptionPaymentConfig().mode,
  });

  await verifyDependenciesOnStartup();

  server = app.listen(env.PORT, () => {
    log('info', 'startup.listening', {
      port: env.PORT,
      healthUrl: `http://0.0.0.0:${env.PORT}/health`,
    });
  });
}

start().catch((error) => {
  log('error', 'startup.failed', { error: serializeError(error) });
  process.exit(1);
});
