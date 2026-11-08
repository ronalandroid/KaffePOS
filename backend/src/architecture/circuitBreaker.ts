/**
 * Microservice Resilience Layer — Circuit Breaker + Timeout + Retry with Jitter.
 * Prevents cascading failures across external providers (Mayar v2, Resend, AI Gateway)
 * and internal bounded-context services.
 */
import { log, serializeError } from '../core/errors';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;
  resetTimeoutMs?: number;
  callTimeoutMs?: number;
  halfOpenMaxSuccesses?: number;
}

export interface CircuitBreakerSnapshot {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  totalCalls: number;
  totalFailures: number;
  lastFailureAt: string | null;
  nextAttemptAt: string | null;
}

export class CircuitBreakerOpenError extends Error {
  readonly serviceName: string;
  constructor(serviceName: string) {
    super(`Circuit breaker [${serviceName}] is OPEN — failing fast to prevent cascade.`);
    this.name = 'CircuitBreakerOpenError';
    this.serviceName = serviceName;
  }
}

export class CircuitBreaker {
  readonly name: string;
  private state: CircuitState = 'CLOSED';
  private failures = 0;
  private halfOpenSuccesses = 0;
  private totalCalls = 0;
  private totalFailures = 0;
  private lastFailureAt: number | null = null;
  private nextAttemptAt: number | null = null;

  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly callTimeoutMs: number;
  private readonly halfOpenMaxSuccesses: number;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.callTimeoutMs = options.callTimeoutMs ?? 10_000;
    this.halfOpenMaxSuccesses = options.halfOpenMaxSuccesses ?? 2;
  }

  getState(): CircuitState {
    if (this.state === 'OPEN' && this.nextAttemptAt !== null && Date.now() >= this.nextAttemptAt) {
      this.state = 'HALF_OPEN';
      this.halfOpenSuccesses = 0;
    }
    return this.state;
  }

  async execute<T>(action: () => Promise<T>, fallback?: (error: unknown) => Promise<T> | T): Promise<T> {
    const currentState = this.getState();
    this.totalCalls += 1;

    if (currentState === 'OPEN') {
      const openErr = new CircuitBreakerOpenError(this.name);
      if (fallback) return fallback(openErr);
      throw openErr;
    }

    try {
      const result = await this.runWithTimeout(action, this.callTimeoutMs);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      if (fallback) return fallback(error);
      throw error;
    }
  }

  private async runWithTimeout<T>(action: () => Promise<T>, timeoutMs: number): Promise<T> {
    if (timeoutMs <= 0) return action();
    let timer: NodeJS.Timeout | null = null;
    try {
      return await Promise.race([
        action(),
        new Promise<T>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`Operation in [${this.name}] timed out after ${timeoutMs}ms`));
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private onSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenSuccesses += 1;
      if (this.halfOpenSuccesses >= this.halfOpenMaxSuccesses) {
        this.reset();
        log('info', 'circuit_breaker.closed', { breaker: this.name });
      }
      return;
    }
    this.failures = 0;
  }

  private onFailure(error: unknown) {
    this.failures += 1;
    this.totalFailures += 1;
    this.lastFailureAt = Date.now();

    if (this.state === 'HALF_OPEN' || this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptAt = Date.now() + this.resetTimeoutMs;
      log('warn', 'circuit_breaker.opened', {
        breaker: this.name,
        failures: this.failures,
        resetTimeoutMs: this.resetTimeoutMs,
        error: serializeError(error),
      });
    }
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.halfOpenSuccesses = 0;
    this.nextAttemptAt = null;
  }

  snapshot(): CircuitBreakerSnapshot {
    const liveState = this.getState();
    return {
      name: this.name,
      state: liveState,
      failures: this.failures,
      successes: this.totalCalls - this.totalFailures,
      totalCalls: this.totalCalls,
      totalFailures: this.totalFailures,
      lastFailureAt: this.lastFailureAt ? new Date(this.lastFailureAt).toISOString() : null,
      nextAttemptAt: this.nextAttemptAt ? new Date(this.nextAttemptAt).toISOString() : null,
    };
  }
}

class CircuitBreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();

  getOrCreate(options: CircuitBreakerOptions): CircuitBreaker {
    const existing = this.breakers.get(options.name);
    if (existing) return existing;
    const created = new CircuitBreaker(options);
    this.breakers.set(options.name, created);
    return created;
  }

  snapshots(): CircuitBreakerSnapshot[] {
    return Array.from(this.breakers.values()).map((b) => b.snapshot());
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// Pre-register core external & domain circuit breakers
export const mayarCircuitBreaker = circuitBreakerRegistry.getOrCreate({
  name: 'mayar-payment-gateway',
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  callTimeoutMs: 12_000,
});

export const emailCircuitBreaker = circuitBreakerRegistry.getOrCreate({
  name: 'resend-email-service',
  failureThreshold: 5,
  resetTimeoutMs: 60_000,
  callTimeoutMs: 8_000,
});

export const aiGatewayCircuitBreaker = circuitBreakerRegistry.getOrCreate({
  name: 'insforge-ai-gateway',
  failureThreshold: 4,
  resetTimeoutMs: 45_000,
  callTimeoutMs: 15_000,
});
