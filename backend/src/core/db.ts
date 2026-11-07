/**
 * Database pool + transaction helper.
 * All route modules import pool from here.
 */
import { Pool, type PoolClient } from 'pg';
import { env, type Env } from './env';
import { log, serializeError } from './errors';

export type { PoolClient } from 'pg';

type DatabaseSslEnv = Pick<Env, 'DB_SSL' | 'DB_SSL_REJECT_UNAUTHORIZED' | 'DB_SSL_CA'> & {
  DATABASE_URL?: string | undefined;
};

export function isManagedTlsDatabaseUrl(connectionString?: string): boolean {
  if (!connectionString) return false;
  return (
    /\.database\.insforge\.app(?::\d+)?(?:\/|$)/i.test(connectionString) ||
    /[?&]sslmode=(?:require|verify-ca|verify-full)(?:&|$)/i.test(connectionString)
  );
}

export function normalizeDatabaseConnectionString(connectionString: string): string {
  try {
    const parsed = new URL(connectionString);
    if (parsed.searchParams.has('sslmode')) {
      parsed.searchParams.delete('sslmode');
      return parsed.toString();
    }
    return connectionString;
  } catch {
    return connectionString;
  }
}

export function buildDatabaseSslConfig(input: DatabaseSslEnv) {
  const autoTls = isManagedTlsDatabaseUrl(input.DATABASE_URL);
  if (input.DB_SSL !== 'true' && !autoTls) return false;

  return {
    rejectUnauthorized: input.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    ...(input.DB_SSL_CA?.trim()
      ? { ca: input.DB_SSL_CA.replace(/\\n/g, '\n') }
      : {}),
  };
}

export const pool = new Pool(
  env.DATABASE_URL
    ? {
        connectionString: normalizeDatabaseConnectionString(env.DATABASE_URL),
        ssl: buildDatabaseSslConfig(env),
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      }
    : {
        host: env.DB_HOST,
        port: env.DB_PORT,
        database: env.DB_NAME,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        ssl: buildDatabaseSslConfig(env),
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      },
);

pool.on('error', (error) => {
  log('error', 'database.pool.error', { error: serializeError(error) });
});

export async function withTransaction<T>(runner: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();

  try {
    await client.query('begin');
    const result = await runner(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
