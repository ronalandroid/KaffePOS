import { createClient } from '@insforge/sdk';

export const INSFORGE_DEFAULT_HOST = 'https://6x4q2bgn.ap-southeast.insforge.app';

const rawBaseUrl = (import.meta.env.VITE_INSFORGE_URL as string | undefined)?.trim();
const rawAnonKey = (import.meta.env.VITE_INSFORGE_ANON_KEY as string | undefined)?.trim();

export const insforgeBaseUrl = rawBaseUrl || INSFORGE_DEFAULT_HOST;
export const insforgeAnonKey = rawAnonKey || '';
export const isInsforgeConfigured = Boolean(rawBaseUrl && rawAnonKey);

export const insforge = createClient({
  baseUrl: insforgeBaseUrl,
  anonKey: insforgeAnonKey,
});

export interface InsforgeCloudStatus {
  ok: boolean;
  service: string;
  provider: 'insforge';
  region: string;
  host: string;
  database: {
    ok: boolean;
    latencyMs: number;
  };
  appVersion: {
    version: string;
    release_channel: string;
    update_policy: string;
    min_supported_web_version: string;
    min_supported_apk_version: string;
    schema_version: string;
  } | null;
  time: string;
}

export async function fetchInsforgeCloudStatus(): Promise<InsforgeCloudStatus | null> {
  if (!insforgeAnonKey) return null;

  const { data, error } = await insforge.functions.invoke<InsforgeCloudStatus>('kaffepos-status', {
    method: 'GET',
  });

  if (error || !data) {
    return null;
  }

  return data;
}
