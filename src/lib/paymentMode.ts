/**
 * Central switch for the beli-putus (one-time purchase) distribution mode.
 * When the deployment disables the payment gateway, every in-app purchase
 * surface (pricing, upgrade prompts/banners, checkout) is hidden — access is
 * granted out-of-band by activating the account with the 'lifetime' cycle.
 */
export const IS_PAYMENT_DISABLED =
  (import.meta.env.VITE_PAYMENT_GATEWAY_PROVIDER || '').trim() === 'disabled' ||
  (import.meta.env.VITE_PAYMENT_INTEGRATION_ENABLED || '').trim() === 'false';
