/**
 * Strips secrets from request URLs before they are logged or alerted.
 * Mayar webhooks may carry the shared webhook token as `?token=...`.
 */
const SECRET_QUERY_KEYS = /([?&](?:token|webhook_token|access_token|api_key|apikey|signature)=)[^&#]*/gi;

export function redactUrlSecrets(url: string | null | undefined): string {
  if (!url) return '';
  return url.replace(SECRET_QUERY_KEYS, '$1[redacted]');
}
