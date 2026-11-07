import { createClient } from 'npm:@insforge/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export default async function (req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const startedAt = Date.now();
  const baseUrl = Deno.env.get('INSFORGE_URL') || 'https://6x4q2bgn.ap-southeast.insforge.app';
  const anonKey = Deno.env.get('INSFORGE_ANON_KEY') || Deno.env.get('ANON_KEY') || '';

  try {
    const client = createClient({
      baseUrl,
      anonKey,
    });

    const { data, error } = await client.database
      .from('app_versions')
      .select('version, release_channel, update_policy, min_supported_web_version, min_supported_apk_version, schema_version')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      return jsonResponse(
        {
          ok: false,
          provider: 'insforge',
          region: 'ap-southeast',
          error: error.message || 'Database query failed',
          latencyMs: Date.now() - startedAt,
          time: new Date().toISOString(),
        },
        503,
      );
    }

    const latestVersion = Array.isArray(data) && data.length > 0 ? data[0] : null;

    return jsonResponse({
      ok: true,
      service: 'kaffepos-insforge-edge',
      provider: 'insforge',
      region: 'ap-southeast',
      host: baseUrl,
      database: {
        ok: true,
        latencyMs: Date.now() - startedAt,
      },
      appVersion: latestVersion,
      time: new Date().toISOString(),
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        provider: 'insforge',
        region: 'ap-southeast',
        error: err instanceof Error ? err.message : 'Internal edge error',
        latencyMs: Date.now() - startedAt,
        time: new Date().toISOString(),
      },
      500,
    );
  }
}
