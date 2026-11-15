import { env } from '../core';
import type { PaymentProviderName, PaymentProvider } from './payment-provider.types';
import { DisabledPaymentProvider } from './providers/disabled.provider';
import { MayarPaymentProvider } from './providers/mayar.provider';

/** Mayar is the only online payment gateway; `disabled` turns online payments off. */
export function getActivePaymentProviderName(): PaymentProviderName {
  if (env.PAYMENT_INTEGRATION_ENABLED === 'false') return 'disabled';
  return env.PAYMENT_GATEWAY_PROVIDER;
}

export function createPaymentProvider(providerName: PaymentProviderName = getActivePaymentProviderName()): PaymentProvider {
  if (providerName === 'mayar') return new MayarPaymentProvider();
  return new DisabledPaymentProvider();
}
