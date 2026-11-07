function isManagedTlsDatabaseUrl(connectionString) {
  if (!connectionString) return false;
  return (
    /\.database\.insforge\.app(?::\d+)?(?:\/|$)/i.test(connectionString) ||
    /[?&]sslmode=(?:require|verify-ca|verify-full)(?:&|$)/i.test(connectionString)
  );
}

function normalizeDatabaseConnectionString(connectionString) {
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

export function buildDatabaseSslConfig() {
  const autoTls = isManagedTlsDatabaseUrl(process.env.DATABASE_URL);
  if (process.env.DB_SSL !== 'true' && !autoTls) return false;

  return {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    ...(process.env.DB_SSL_CA?.trim()
      ? { ca: process.env.DB_SSL_CA.replace(/\\n/g, '\n') }
      : {}),
  };
}

export function buildPoolConfig() {
  const ssl = buildDatabaseSslConfig();
  if (process.env.DATABASE_URL) {
    return {
      connectionString: normalizeDatabaseConnectionString(process.env.DATABASE_URL),
      ssl,
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'kaffepos_production',
    user: process.env.DB_USER || 'kaffepos',
    password: process.env.DB_PASSWORD,
    ssl,
  };
}
