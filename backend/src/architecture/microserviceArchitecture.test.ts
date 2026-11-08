import { describe, expect, it, vi } from 'vitest';
import {
  BOUNDED_MICROSERVICES,
  CircuitBreaker,
  CircuitBreakerOpenError,
  DomainEventBus,
  domainEventBus,
  getServiceTopologySnapshot,
  microserviceGatewayMiddleware,
  resolveBoundedService,
} from './index';
import { cache } from '../lib/cache';

describe('Microservice Resilience — CircuitBreaker', () => {
  it('transitions CLOSED -> OPEN after failureThreshold and recovers via HALF_OPEN -> CLOSED', async () => {
    const breaker = new CircuitBreaker({
      name: 'test-payment-breaker',
      failureThreshold: 2,
      resetTimeoutMs: 40,
      callTimeoutMs: 500,
      halfOpenMaxSuccesses: 1,
    });

    expect(breaker.getState()).toBe('CLOSED');

    await expect(
      breaker.execute(async () => {
        throw new Error('upstream 502');
      }),
    ).rejects.toThrow('upstream 502');
    expect(breaker.getState()).toBe('CLOSED');

    await expect(
      breaker.execute(async () => {
        throw new Error('upstream 502 again');
      }),
    ).rejects.toThrow('upstream 502 again');
    expect(breaker.getState()).toBe('OPEN');

    // Fast-fail when OPEN
    await expect(breaker.execute(async () => 'ok')).rejects.toBeInstanceOf(CircuitBreakerOpenError);

    // Fallback works when OPEN
    const fallbackResult = await breaker.execute(
      async () => 'ok',
      () => 'fallback-response',
    );
    expect(fallbackResult).toBe('fallback-response');

    // Wait for resetTimeoutMs to enter HALF_OPEN and recover to CLOSED
    await new Promise((resolve) => setTimeout(resolve, 55));
    expect(breaker.getState()).toBe('HALF_OPEN');

    const recovered = await breaker.execute(async () => 'recovered-ok');
    expect(recovered).toBe('recovered-ok');
    expect(breaker.getState()).toBe('CLOSED');
  });
});

describe('Event-Driven Choreography — DomainEventBus', () => {
  it('publishes events asynchronously, retries transient failures, and records dead letters on exhaustion', async () => {
    const bus = new DomainEventBus();
    const received: string[] = [];

    bus.subscribe('order.checked_out', 'kds-subscriber', (evt) => {
      received.push(`${evt.boundedContext}:${evt.correlationId}`);
    });

    bus.subscribe(
      'order.checked_out',
      'failing-subscriber',
      () => {
        throw new Error('downstream outage');
      },
      { maxRetries: 1 },
    );

    const published = bus.publish({
      name: 'order.checked_out',
      boundedContext: 'pos-order-service',
      storeId: '11111111-1111-1111-1111-111111111111',
      correlationId: 'corr-123',
      payload: { total: 75000 },
    });

    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(received).toEqual(['pos-order-service:corr-123']);
    const snap = bus.snapshot();
    expect(snap.publishedCount).toBe(1);
    expect(snap.deliveredCount).toBe(1);
    expect(snap.failedCount).toBe(1);
    expect(snap.deadLetterQueueSize).toBe(1);
    expect(snap.recentDeadLetters[0]?.eventId).toBe(published.id);
    expect(snap.recentDeadLetters[0]?.subscriberName).toBe('failing-subscriber');
  });

  it('invalidates bounded-context caches when domainEventBus publishes order and PO events', async () => {
    const storeId = '22222222-2222-2222-2222-222222222222';
    cache.set(`inventory:${storeId}`, [{ id: 'inv-1' }], 60_000);
    cache.set(`menu-items:${storeId}`, [{ id: 'menu-1' }], 60_000);
    cache.set(`open-bills:${storeId}`, [{ id: 'bill-1' }], 60_000);

    domainEventBus.publish({
      name: 'purchase_order.received',
      boundedContext: 'inventory-po-service',
      storeId,
      payload: { poId: 'po-1' },
    });

    domainEventBus.publish({
      name: 'open_bill.saved',
      boundedContext: 'pos-order-service',
      storeId,
      payload: { billId: 'bill-1' },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(cache.get(`inventory:${storeId}`)).toBeNull();
    expect(cache.get(`menu-items:${storeId}`)).toBeNull();
    expect(cache.get(`open-bills:${storeId}`)).toBeNull();
  });
});

describe('Bounded-Context Service Registry & API Gateway', () => {
  it('maps API routes to their authoritative bounded-context microservice', () => {
    expect(BOUNDED_MICROSERVICES.length).toBe(8);
    expect(resolveBoundedService('/api/v1/auth/login').id).toBe('identity-service');
    expect(resolveBoundedService('/api/menu-items?storeId=123').id).toBe('catalog-service');
    expect(resolveBoundedService('/api/fnb/purchase-orders').id).toBe('inventory-po-service');
    expect(resolveBoundedService('/api/fnb/open-bills').id).toBe('pos-order-service');
    expect(resolveBoundedService('/api/fnb/shift-closings').id).toBe('pos-order-service');
    expect(resolveBoundedService('/api/transactions/checkout').id).toBe('pos-order-service');
    expect(resolveBoundedService('/api/kitchen/orders').id).toBe('kds-realtime-service');
    expect(resolveBoundedService('/api/webhooks/mayar').id).toBe('payment-billing-service');
    expect(resolveBoundedService('/api/loyalty/members').id).toBe('crm-gamification-service');
    expect(resolveBoundedService('/health/services').id).toBe('intelligence-ops-service');
  });

  it('attaches X-Kaffe-Serviceheaders and enforces MICROSERVICE_TARGET container isolation', () => {
    const middleware = microserviceGatewayMiddleware();
    const headers: Record<string, string> = {};
    const finishHandlers: Array<() => void> = [];

    const reqMock: any = {
      originalUrl: '/api/fnb/open-bills?storeId=abc',
      url: '/api/fnb/open-bills?storeId=abc',
      headers: { 'x-correlation-id': 'trace-999' },
      requestId: 'req-1',
    };
    const resMock: any = {
      statusCode: 200,
      setHeader: (k: string, v: string) => {
        headers[k] = v;
      },
      on: (event: string, cb: () => void) => {
        if (event === 'finish') finishHandlers.push(cb);
      },
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    middleware(reqMock, resMock, next);
    for (const cb of finishHandlers) cb();

    expect(next).toHaveBeenCalledOnce();
    expect(headers['X-Kaffe-Service']).toBe('pos-order-service');
    expect(headers['X-Correlation-Id']).toBe('trace-999');

    // Test isolated microservice target mode
    process.env.MICROSERVICE_TARGET = 'catalog-service';
    try {
      const blockedNext = vi.fn();
      middleware(reqMock, resMock, blockedNext);
      expect(blockedNext).not.toHaveBeenCalled();
      expect(resMock.status).toHaveBeenCalledWith(503);
    } finally {
      delete process.env.MICROSERVICE_TARGET;
    }

    const topology = getServiceTopologySnapshot();
    expect(topology.totalBoundedServices).toBe(8);
    expect(topology.deploymentMode).toBe('unified-gateway-cluster');
  });
});
