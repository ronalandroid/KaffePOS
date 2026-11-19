/**
 * InsForge Cloud SDK & Database Provider Integration.
 * Connects KaffePOS backend with InsForge PostgreSQL, Edge Functions, Storage & Realtime.
 */
import type { createAdminClient, createClient } from '@insforge/sdk';
import { env } from './env';
import { isManagedTlsDatabaseUrl } from './db';

export const INSFORGE_DEFAULT_PROJECT_ID = '9be3a9b0-568c-4a0c-bd32-f655dcfcdc79';
export const INSFORGE_DEFAULT_HOST = 'https://849uckhn.ap-southeast.insforge.app';

export function isInsforgeDatabaseTarget(databaseUrl = env.DATABASE_URL): boolean {
  if (!databaseUrl) return false;
  return /\.database\.insforge\.app(?::\d+)?(?:\/|$)/i.test(databaseUrl);
}

export function resolveInsforgeHost(): string {
  return env.INSFORGE_URL || INSFORGE_DEFAULT_HOST;
}

export function isInsforgeSdkConfigured(): boolean {
  return Boolean(
    (env.INSFORGE_URL || isInsforgeDatabaseTarget()) &&
      (env.INSFORGE_ANON_KEY || env.INSFORGE_API_KEY),
  );
}

type InsforgeSdkModule = {
  createClient: typeof createClient;
  createAdminClient: typeof createAdminClient;
};

async function importEsm(specifier: string): Promise<InsforgeSdkModule> {
  return (await import(specifier)) as unknown as InsforgeSdkModule;
}

let cachedClientPromise: Promise<ReturnType<typeof createClient>> | null = null;
let cachedAdminClientPromise: Promise<ReturnType<typeof createAdminClient>> | null = null;

export async function getInsforgeClient() {
  if (!cachedClientPromise) {
    cachedClientPromise = importEsm('@insforge/sdk').then((mod) =>
      mod.createClient({
        baseUrl: resolveInsforgeHost(),
        anonKey: env.INSFORGE_ANON_KEY || '',
      }),
    );
  }
  return cachedClientPromise;
}

export async function getInsforgeAdminClient() {
  if (!env.INSFORGE_API_KEY) {
    return null;
  }
  if (!cachedAdminClientPromise) {
    const apiKey = env.INSFORGE_API_KEY;
    cachedAdminClientPromise = importEsm('@insforge/sdk').then((mod) =>
      mod.createAdminClient({
        baseUrl: resolveInsforgeHost(),
        apiKey,
      }),
    );
  }
  return cachedAdminClientPromise;
}

export function getDatabaseProviderSummary() {
  const isInsforgeDb = isInsforgeDatabaseTarget(env.DATABASE_URL);
  return {
    provider: isInsforgeDb ? ('insforge' as const) : ('postgresql' as const),
    tlsEnabled: env.DB_SSL === 'true' || isManagedTlsDatabaseUrl(env.DATABASE_URL),
    insforgeHost: isInsforgeDb || env.INSFORGE_URL ? resolveInsforgeHost() : null,
    sdkConfigured: isInsforgeSdkConfigured(),
  };
}
