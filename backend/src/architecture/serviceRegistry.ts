/**
 * Bounded-Context Microservice Registry & API Gateway Router.
 *
 * Defines strict service boundaries, database table ownership, SLA budgets,
 * live per-service telemetry, and `MICROSERVICE_TARGET` selective container isolation.
 */
import type { NextFunction, Request, Response } from 'express';
import { circuitBreakerRegistry } from './circuitBreaker';
import { domainEventBus } from './eventBus';

export type MicroserviceId =
  | 'identity-service'
  | 'catalog-service'
  | 'inventory-po-service'
  | 'pos-order-service'
  | 'kds-realtime-service'
  | 'payment-billing-service'
  | 'crm-gamification-service'
  | 'intelligence-ops-service';

export interface BoundedMicroserviceDefinition {
  id: MicroserviceId;
  boundedContext: string;
  description: string;
  routePrefixes: string[];
  ownedTables: string[];
  publishedEvents: string[];
  subscribedEvents: string[];
  slaTargetMs: number;
  scalingStrategy: 'stateless-horizontal' | 'event-driven-worker' | 'read-replica-cached';
}

export interface MicroserviceRuntimeMetrics {
  requestsTotal: number;
  errorsTotal: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  lastRequestAt: string | null;
  status: 'HEALTHY' | 'DEGRADED';
}

export const BOUNDED_MICROSERVICES: readonly BoundedMicroserviceDefinition[] = [
  {
    id: 'identity-service',
    boundedContext: 'Identity & Multi-Outlet Access Control',
    description: 'Handles authentication sessions, RBAC permissions, multi-outlet store ownership, cashier PINs, and MFA.',
    routePrefixes: ['/api/auth', '/api/v1/auth', '/api/stores', '/api/v1/stores', '/api/cashiers', '/api/v1/cashiers', '/api/admin/mfa'],
    ownedTables: ['profiles', 'app_auth_credentials', 'app_auth_sessions', 'stores', 'cashier_outlet_assignments'],
    publishedEvents: [],
    subscribedEvents: [],
    slaTargetMs: 120,
    scalingStrategy: 'stateless-horizontal',
  },
  {
    id: 'catalog-service',
    boundedContext: 'Menu, Dynamic Pricing & Combo Catalog',
    description: 'Manages outlet menu items, Paket Kombo bundles, COGS recipes, and memory-cached catalog reads.',
    routePrefixes: ['/api/menu-items', '/api/v1/menu-items'],
    ownedTables: ['menu_items', 'product_recipes'],
    publishedEvents: [],
    subscribedEvents: ['purchase_order.received'],
    slaTargetMs: 80,
    scalingStrategy: 'read-replica-cached',
  },
  {
    id: 'inventory-po-service',
    boundedContext: 'Warehouse Inventory, Unit Conversions & Supplier PO',
    description: 'Controls raw material stock engine, unit conversions, supplier purchase orders (PO), stock receiving, and expenses.',
    routePrefixes: [
      '/api/inventory',
      '/api/v1/inventory',
      '/api/unit-conversions',
      '/api/v1/unit-conversions',
      '/api/fnb/purchase-orders',
      '/api/v1/fnb/purchase-orders',
      '/api/expenses',
      '/api/v1/expenses',
    ],
    ownedTables: ['inventory', 'inventory_unit_conversions', 'purchase_orders', 'transaction_inventory_audit', 'expenses'],
    publishedEvents: ['purchase_order.created', 'purchase_order.received'],
    subscribedEvents: ['order.checked_out', 'order.voided'],
    slaTargetMs: 150,
    scalingStrategy: 'stateless-horizontal',
  },
  {
    id: 'pos-order-service',
    boundedContext: 'POS Checkout, Floor Tables, Open Bills & Shift Drawer',
    description: 'Executes advisory-locked POS checkouts, Open Bill save/recall, table move/merge, split bill, and shift cash closings.',
    routePrefixes: [
      '/api/transactions',
      '/api/v1/transactions',
      '/api/fnb/open-bills',
      '/api/v1/fnb/open-bills',
      '/api/fnb/shift-closings',
      '/api/v1/fnb/shift-closings',
      '/api/cash-register',
      '/api/v1/cash-register',
    ],
    ownedTables: ['transactions', 'open_bills', 'shift_closings', 'cashier_sessions'],
    publishedEvents: ['order.checked_out', 'order.voided', 'open_bill.saved', 'open_bill.updated', 'shift.closed'],
    subscribedEvents: ['open_bill.saved', 'open_bill.updated'],
    slaTargetMs: 200,
    scalingStrategy: 'stateless-horizontal',
  },
  {
    id: 'kds-realtime-service',
    boundedContext: 'Kitchen Display System (KDS) & Station Routing',
    description: 'Streams kitchen/bar/dessert tickets, station state transitions, and SLA prep timers.',
    routePrefixes: ['/api/kitchen', '/api/v1/kitchen'],
    ownedTables: ['kitchen_orders', 'kitchen_order_items', 'kitchen_order_events'],
    publishedEvents: [],
    subscribedEvents: ['order.checked_out', 'order.voided'],
    slaTargetMs: 100,
    scalingStrategy: 'event-driven-worker',
  },
  {
    id: 'payment-billing-service',
    boundedContext: 'Mayar v2 Payment Gateway, QRIS & SaaS Subscriptions',
    description: 'Integrates Mayar API v2 dynamic QRIS/payment links, webhook verification, and SaaS plan billing.',
    routePrefixes: [
      '/api/payments',
      '/api/v1/payments',
      '/api/payment',
      '/api/v1/payment',
      '/api/subscriptions',
      '/api/v1/subscriptions',
      '/api/webhooks',
      '/api/v1/webhooks',
      '/webhooks',
    ],
    ownedTables: ['subscriptions', 'subscription_payments', 'payment_webhooks'],
    publishedEvents: ['payment.completed'],
    subscribedEvents: [],
    slaTargetMs: 350,
    scalingStrategy: 'stateless-horizontal',
  },
  {
    id: 'crm-gamification-service',
    boundedContext: 'Loyalty CRM, Barista Gamification & Affiliate Growth',
    description: 'Powers member loyalty points, Kopi Score challenges, referral codes, and affiliate commissions.',
    routePrefixes: [
      '/api/loyalty',
      '/api/v1/loyalty',
      '/api/challenges',
      '/api/v1/challenges',
      '/api/referrals',
      '/api/v1/referrals',
      '/api/affiliate',
      '/api/v1/affiliate',
    ],
    ownedTables: ['loyalty_members', 'loyalty_transactions', 'challenges', 'user_challenges', 'referrals', 'affiliates'],
    publishedEvents: [],
    subscribedEvents: ['order.checked_out'],
    slaTargetMs: 150,
    scalingStrategy: 'stateless-horizontal',
  },
  {
    id: 'intelligence-ops-service',
    boundedContext: 'AI Business Engine, Telemetry & Platform Governance',
    description: 'Serves AI insights, operational notifications, APM metrics, health probes, and microservice topology discovery.',
    routePrefixes: [
      '/api/admin',
      '/api/v1/admin',
      '/api/notifications',
      '/api/v1/notifications',
      '/api/app-version',
      '/api/v1/app-version',
      '/health',
      '/metrics',
      '/system-status',
    ],
    ownedTables: ['notifications', 'app_versions', 'audit_logs'],
    publishedEvents: [],
    subscribedEvents: ['shift.closed', 'order.checked_out'],
    slaTargetMs: 120,
    scalingStrategy: 'read-replica-cached',
  },
];

interface InternalServiceStats {
  requestsTotal: number;
  errorsTotal: number;
  latenciesMs: number[];
  lastRequestAt: number | null;
}

const serviceStats = new Map<MicroserviceId, InternalServiceStats>();
for (const svc of BOUNDED_MICROSERVICES) {
  serviceStats.set(svc.id, {
    requestsTotal: 0,
    errorsTotal: 0,
    latenciesMs: [],
    lastRequestAt: null,
  });
}

export function resolveBoundedService(requestPath: string): BoundedMicroserviceDefinition {
  const normalizedPath = requestPath.split('?')[0] || '/';
  for (const service of BOUNDED_MICROSERVICES) {
    for (const prefix of service.routePrefixes) {
      if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) {
        return service;
      }
    }
  }
  return BOUNDED_MICROSERVICES[BOUNDED_MICROSERVICES.length - 1]!;
}

export function recordServiceCall(serviceId: MicroserviceId, latencyMs: number, statusCode: number) {
  const stats = serviceStats.get(serviceId);
  if (!stats) return;
  stats.requestsTotal += 1;
  if (statusCode >= 500) {
    stats.errorsTotal += 1;
  }
  stats.lastRequestAt = Date.now();
  stats.latenciesMs.push(Math.max(0, Math.round(latencyMs)));
  if (stats.latenciesMs.length > 200) {
    stats.latenciesMs.shift();
  }
}

function computeServiceMetrics(serviceId: MicroserviceId): MicroserviceRuntimeMetrics {
  const stats = serviceStats.get(serviceId);
  if (!stats || stats.latenciesMs.length === 0) {
    return {
      requestsTotal: stats?.requestsTotal ?? 0,
      errorsTotal: stats?.errorsTotal ?? 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      lastRequestAt: stats?.lastRequestAt ? new Date(stats.lastRequestAt).toISOString() : null,
      status: 'HEALTHY',
    };
  }

  const sum = stats.latenciesMs.reduce((acc, v) => acc + v, 0);
  const avg = Math.round(sum / stats.latenciesMs.length);
  const sorted = [...stats.latenciesMs].sort((a, b) => a - b);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95 = sorted[p95Index] ?? avg;
  const errorRate = stats.requestsTotal > 0 ? stats.errorsTotal / stats.requestsTotal : 0;

  return {
    requestsTotal: stats.requestsTotal,
    errorsTotal: stats.errorsTotal,
    avgLatencyMs: avg,
    p95LatencyMs: p95,
    lastRequestAt: stats.lastRequestAt ? new Date(stats.lastRequestAt).toISOString() : null,
    status: errorRate > 0.25 ? 'DEGRADED' : 'HEALTHY',
  };
}

/**
 * Express API Gateway Middleware.
 * - Resolves the target microservice for every incoming request.
 * - Attaches `X-Kaffe-Service`, `X-Kaffe-Bounded-Context`, and `X-Correlation-Id` headers.
 * - Supports `MICROSERVICE_TARGET` env var to run a single bounded context per container.
 */
export function microserviceGatewayMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    const targetService = resolveBoundedService(req.originalUrl || req.url);
    const correlationId =
      (typeof req.headers['x-correlation-id'] === 'string' && req.headers['x-correlation-id'].trim()) ||
      req.requestId ||
      'kaffe-req';

    res.setHeader('X-Kaffe-Service', targetService.id);
    res.setHeader('X-Kaffe-Bounded-Context', targetService.boundedContext);
    res.setHeader('X-Correlation-Id', correlationId);

    const activeTarget = (process.env.MICROSERVICE_TARGET || 'all').trim();
    if (
      activeTarget !== 'all' &&
      activeTarget !== targetService.id &&
      targetService.id !== 'intelligence-ops-service'
    ) {
      res.status(503).json({
        error: {
          code: 'SERVICE_BOUNDARY_ISOLATED',
          message: `Instance ini berjalan dalam mode isolasi microservice [${activeTarget}] dan tidak melayani [${targetService.id}].`,
          targetService: targetService.id,
          activeInstanceTarget: activeTarget,
        },
      });
      return;
    }

    res.on('finish', () => {
      recordServiceCall(targetService.id, Date.now() - startedAt, res.statusCode);
    });

    next();
  };
}

export function getServiceTopologySnapshot() {
  const activeTarget = (process.env.MICROSERVICE_TARGET || 'all').trim();
  const services = BOUNDED_MICROSERVICES.map((svc) => ({
    ...svc,
    enabledOnInstance: activeTarget === 'all' || activeTarget === svc.id || svc.id === 'intelligence-ops-service',
    metrics: computeServiceMetrics(svc.id),
  }));

  return {
    architecturePattern: 'Modular Microservice Mesh + Event-Driven Choreography',
    gatewayVersion: 'v2.4-insforge-cloud',
    deploymentMode: activeTarget === 'all' ? 'unified-gateway-cluster' : `isolated-service:${activeTarget}`,
    totalBoundedServices: BOUNDED_MICROSERVICES.length,
    services,
    resilience: {
      circuitBreakers: circuitBreakerRegistry.snapshots(),
    },
    eventBus: domainEventBus.snapshot(),
  };
}
