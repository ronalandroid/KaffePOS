/**
 * Event-Driven Domain Event Bus — Asynchronous Pub/Sub Choreography across Bounded Contexts.
 * Decouples POS Order Service, Inventory & PO Service, Catalog Service, KDS Service,
 * Payment Service, and Intelligence Ops Service without tight synchronous coupling.
 */
import { randomUUID } from 'node:crypto';
import { log, serializeError } from '../core/errors';
import { cache } from '../lib/cache';

export type DomainEventName =
  | 'order.checked_out'
  | 'order.voided'
  | 'open_bill.saved'
  | 'open_bill.updated'
  | 'purchase_order.created'
  | 'purchase_order.received'
  | 'shift.closed'
  | 'payment.completed';

export interface DomainEvent<TPayload = Record<string, unknown>> {
  id: string;
  name: DomainEventName;
  boundedContext: string;
  correlationId: string;
  storeId?: string | undefined;
  actorId?: string | undefined;
  occurredAt: string;
  payload: TPayload;
}

export interface DeadLetterEntry {
  eventId: string;
  eventName: DomainEventName;
  subscriberName: string;
  failedAt: string;
  attempts: number;
  error: unknown;
}

export interface EventBusSnapshot {
  publishedCount: number;
  deliveredCount: number;
  failedCount: number;
  deadLetterQueueSize: number;
  subscribersByEvent: Record<string, string[]>;
  recentDeadLetters: DeadLetterEntry[];
}

type SubscriberHandler<TPayload = Record<string, unknown>> = (
  event: DomainEvent<TPayload>,
) => Promise<void> | void;

interface RegisteredSubscriber {
  subscriberName: string;
  handler: SubscriberHandler<any>;
  maxRetries: number;
}

export class DomainEventBus {
  private readonly subscribers = new Map<DomainEventName, RegisteredSubscriber[]>();
  private readonly deadLetters: DeadLetterEntry[] = [];
  private readonly maxDeadLetters = 100;
  private publishedCount = 0;
  private deliveredCount = 0;
  private failedCount = 0;

  subscribe<TPayload = Record<string, unknown>>(
    eventName: DomainEventName,
    subscriberName: string,
    handler: SubscriberHandler<TPayload>,
    options?: { maxRetries?: number },
  ): () => void {
    const list = this.subscribers.get(eventName) ?? [];
    const entry: RegisteredSubscriber = {
      subscriberName,
      handler,
      maxRetries: options?.maxRetries ?? 2,
    };
    list.push(entry);
    this.subscribers.set(eventName, list);

    return () => {
      const current = this.subscribers.get(eventName) ?? [];
      this.subscribers.set(
        eventName,
        current.filter((item) => item !== entry),
      );
    };
  }

  publish<TPayload = Record<string, unknown>>(input: {
    name: DomainEventName;
    boundedContext: string;
    storeId?: string | undefined;
    actorId?: string | undefined;
    correlationId?: string | undefined;
    payload: TPayload;
  }): DomainEvent<TPayload> {
    const event: DomainEvent<TPayload> = {
      id: randomUUID(),
      name: input.name,
      boundedContext: input.boundedContext,
      correlationId: input.correlationId ?? randomUUID(),
      storeId: input.storeId,
      actorId: input.actorId,
      occurredAt: new Date().toISOString(),
      payload: input.payload,
    };

    this.publishedCount += 1;
    const handlers = this.subscribers.get(input.name) ?? [];

    for (const sub of handlers) {
      void this.dispatchWithRetry(event, sub);
    }

    return event;
  }

  private async dispatchWithRetry(event: DomainEvent<any>, sub: RegisteredSubscriber): Promise<void> {
    let attempt = 0;
    while (attempt <= sub.maxRetries) {
      attempt += 1;
      try {
        await sub.handler(event);
        this.deliveredCount += 1;
        return;
      } catch (error) {
        if (attempt > sub.maxRetries) {
          this.failedCount += 1;
          this.recordDeadLetter({
            eventId: event.id,
            eventName: event.name,
            subscriberName: sub.subscriberName,
            failedAt: new Date().toISOString(),
            attempts: attempt,
            error: serializeError(error),
          });
          log('warn', 'domain_event.dead_letter', {
            eventId: event.id,
            eventName: event.name,
            subscriberName: sub.subscriberName,
            attempts: attempt,
            error: serializeError(error),
          });
          return;
        }
        const backoffMs = Math.min(50 * 2 ** (attempt - 1), 400);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  private recordDeadLetter(entry: DeadLetterEntry) {
    this.deadLetters.push(entry);
    if (this.deadLetters.length > this.maxDeadLetters) {
      this.deadLetters.shift();
    }
  }

  snapshot(): EventBusSnapshot {
    const subscribersByEvent: Record<string, string[]> = {};
    for (const [eventName, subs] of this.subscribers.entries()) {
      subscribersByEvent[eventName] = subs.map((s) => s.subscriberName);
    }
    return {
      publishedCount: this.publishedCount,
      deliveredCount: this.deliveredCount,
      failedCount: this.failedCount,
      deadLetterQueueSize: this.deadLetters.length,
      subscribersByEvent,
      recentDeadLetters: this.deadLetters.slice(-10),
    };
  }
}

export const domainEventBus = new DomainEventBus();

// ── Cross-Bounded-Context Choreography Subscribers ─────────────────
domainEventBus.subscribe(
  'order.checked_out',
  'inventory-po-service:cache-invalidator',
  (event) => {
    if (event.storeId) {
      cache.deleteByPrefix(`inventory:${event.storeId}`);
      cache.deleteByPrefix(`open-bills:${event.storeId}`);
      cache.deleteByPrefix(`dashboard:${event.storeId}`);
    }
  },
);

domainEventBus.subscribe(
  'order.voided',
  'inventory-po-service:void-cache-invalidator',
  (event) => {
    if (event.storeId) {
      cache.deleteByPrefix(`inventory:${event.storeId}`);
      cache.deleteByPrefix(`dashboard:${event.storeId}`);
    }
  },
);

domainEventBus.subscribe(
  'open_bill.saved',
  'pos-order-service:open-bill-cache-sync',
  (event) => {
    if (event.storeId) {
      cache.deleteByPrefix(`open-bills:${event.storeId}`);
    }
  },
);

domainEventBus.subscribe(
  'open_bill.updated',
  'pos-order-service:open-bill-update-sync',
  (event) => {
    if (event.storeId) {
      cache.deleteByPrefix(`open-bills:${event.storeId}`);
    }
  },
);

domainEventBus.subscribe(
  'purchase_order.received',
  'catalog-service:stock-cost-invalidator',
  (event) => {
    if (event.storeId) {
      cache.deleteByPrefix(`inventory:${event.storeId}`);
      cache.deleteByPrefix(`menu-items:${event.storeId}`);
      cache.deleteByPrefix(`purchase-orders:${event.storeId}`);
    }
  },
);

domainEventBus.subscribe(
  'shift.closed',
  'intelligence-ops-service:shift-audit-sync',
  (event) => {
    if (event.storeId) {
      cache.deleteByPrefix(`shift-closings:${event.storeId}`);
      cache.deleteByPrefix(`dashboard:${event.storeId}`);
    }
  },
);
