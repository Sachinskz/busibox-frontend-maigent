/**
 * GET /api/bridge-settings/inbox
 *
 * Fetches recent messages from the configured IMAP inbox via bridge.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getBridgeApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') || '20';

    const bridgeUrl = getBridgeApiUrl();
    const resp = await fetch(`${bridgeUrl}/api/v1/email/inbox?limit=${limit}`, {
      cache: 'no-store',
    });

    if (!resp.ok) {
      const payload = await resp.json().catch(() => ({}));
      const msg = payload?.detail || payload?.error || `Bridge error (${resp.status})`;
      return apiError(msg, 502);
    }

    const data = await resp.json();
    return apiSuccess(data);
  } catch (error) {
    console.error('[API] inbox fetch failed:', error);
    return apiError('Failed to fetch inbox', 500);
  }
}
