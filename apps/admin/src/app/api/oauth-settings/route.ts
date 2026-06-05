/**
 * GET  /api/oauth-settings  — Read OAuth integration credentials from config-api (masked)
 * PATCH /api/oauth-settings — Save credentials to config-api and push to authz in-memory
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError, parseJsonBody } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeTokenZeroTrust } from '@jazzmind/busibox-app';

const AUTHZ_BASE_URL = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';
const DATA_API_URL = process.env.DATA_API_URL || 'http://data-api:8002';

const MASKED = '********';

const OAUTH_KEYS = [
  'GOOGLE_INTEGRATION_CLIENT_ID',
  'GOOGLE_INTEGRATION_CLIENT_SECRET',
  'MICROSOFT_INTEGRATION_CLIENT_ID',
  'MICROSOFT_INTEGRATION_CLIENT_SECRET',
  'MICROSOFT_INTEGRATION_TENANT_ID',
] as const;

async function getAuthzToken(sessionJwt: string): Promise<string> {
  const result = await exchangeTokenZeroTrust(
    { sessionJwt, audience: 'authz-api', purpose: 'oauth-settings' },
    { authzBaseUrl: AUTHZ_BASE_URL }
  );
  return result.accessToken;
}

async function getConfigApiToken(sessionJwt: string): Promise<string> {
  const result = await exchangeTokenZeroTrust(
    { sessionJwt, audience: 'config-api', purpose: 'oauth-settings' },
    { authzBaseUrl: AUTHZ_BASE_URL }
  );
  return result.accessToken;
}

async function readFromConfigApi(token: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${DATA_API_URL}/admin/config?category=oauth`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const configs: Array<{ key: string; value: string; encrypted: boolean }> = data.configs ?? [];
    const result: Record<string, string> = {};
    for (const cfg of configs) {
      if (cfg.encrypted) {
        // Fetch raw (decrypted) value
        const rawRes = await fetch(`${DATA_API_URL}/admin/config/${cfg.key}/raw`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (rawRes.ok) {
          const rawData = await rawRes.json();
          result[cfg.key] = rawData.value ?? '';
        }
      } else {
        result[cfg.key] = cfg.value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

async function saveToConfigApi(
  token: string,
  entries: Array<{ key: string; value: string; encrypted: boolean }>
): Promise<void> {
  for (const entry of entries) {
    await fetch(`${DATA_API_URL}/admin/config`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: entry.key,
        value: entry.value,
        category: 'oauth',
        encrypted: entry.encrypted,
        description: `OAuth integration credential: ${entry.key}`,
      }),
    });
  }
}

function maskSecrets(raw: Record<string, string>) {
  return {
    googleClientId: raw['GOOGLE_INTEGRATION_CLIENT_ID'] || null,
    googleClientSecret: raw['GOOGLE_INTEGRATION_CLIENT_SECRET'] ? MASKED : null,
    microsoftClientId: raw['MICROSOFT_INTEGRATION_CLIENT_ID'] || null,
    microsoftClientSecret: raw['MICROSOFT_INTEGRATION_CLIENT_SECRET'] ? MASKED : null,
    microsoftTenantId: raw['MICROSOFT_INTEGRATION_TENANT_ID'] || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const configToken = await getConfigApiToken(auth.sessionJwt);
    const raw = await readFromConfigApi(configToken);
    return apiSuccess(maskSecrets(raw));
  } catch (error) {
    console.error('[oauth-settings] GET error:', error);
    return apiError('Failed to read OAuth settings', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = await parseJsonBody(request);
    if (!body) return apiError('Invalid JSON', 400);

    const configToken = await getConfigApiToken(auth.sessionJwt);
    const authzToken = await getAuthzToken(auth.sessionJwt);

    // Fetch current values so we can keep existing secrets if masked value is sent
    const current = await readFromConfigApi(configToken);

    const resolve = (bodyVal: unknown, currentKey: string): string | null => {
      if (bodyVal === null || bodyVal === undefined) return null;
      const str = String(bodyVal).trim();
      if (str === MASKED) return current[currentKey] || null; // keep existing
      return str || null;
    };

    const googleClientId = resolve(body.googleClientId, 'GOOGLE_INTEGRATION_CLIENT_ID');
    const googleClientSecret = resolve(body.googleClientSecret, 'GOOGLE_INTEGRATION_CLIENT_SECRET');
    const microsoftClientId = resolve(body.microsoftClientId, 'MICROSOFT_INTEGRATION_CLIENT_ID');
    const microsoftClientSecret = resolve(body.microsoftClientSecret, 'MICROSOFT_INTEGRATION_CLIENT_SECRET');
    const microsoftTenantId = resolve(body.microsoftTenantId, 'MICROSOFT_INTEGRATION_TENANT_ID');

    // Write to config-api (secrets are encrypted)
    const entries: Array<{ key: string; value: string; encrypted: boolean }> = [];
    if (googleClientId !== null)
      entries.push({ key: 'GOOGLE_INTEGRATION_CLIENT_ID', value: googleClientId, encrypted: false });
    if (googleClientSecret !== null)
      entries.push({ key: 'GOOGLE_INTEGRATION_CLIENT_SECRET', value: googleClientSecret, encrypted: true });
    if (microsoftClientId !== null)
      entries.push({ key: 'MICROSOFT_INTEGRATION_CLIENT_ID', value: microsoftClientId, encrypted: false });
    if (microsoftClientSecret !== null)
      entries.push({ key: 'MICROSOFT_INTEGRATION_CLIENT_SECRET', value: microsoftClientSecret, encrypted: true });
    if (microsoftTenantId !== null)
      entries.push({ key: 'MICROSOFT_INTEGRATION_TENANT_ID', value: microsoftTenantId, encrypted: false });

    if (entries.length > 0) {
      await saveToConfigApi(configToken, entries);
    }

    // Push to authz in-memory so it takes effect immediately without restart
    const authzBody: Record<string, string | null> = {
      google_client_id: googleClientId,
      google_client_secret: googleClientSecret,
      microsoft_client_id: microsoftClientId,
      microsoft_client_secret: microsoftClientSecret,
      microsoft_tenant_id: microsoftTenantId,
    };

    const authzRes = await fetch(`${AUTHZ_BASE_URL}/admin/integration-config`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authzToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(authzBody),
    });

    if (!authzRes.ok) {
      console.warn('[oauth-settings] Failed to push to authz:', authzRes.status, await authzRes.text());
    }

    const authzData = authzRes.ok ? await authzRes.json() : {};
    return apiSuccess({
      ok: true,
      google_enabled: authzData.google_enabled ?? false,
      microsoft_enabled: authzData.microsoft_enabled ?? false,
    });
  } catch (error) {
    console.error('[oauth-settings] PATCH error:', error);
    return apiError('Failed to save OAuth settings', 500);
  }
}
