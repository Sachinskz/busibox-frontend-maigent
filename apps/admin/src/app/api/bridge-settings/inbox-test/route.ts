/**
 * POST /api/bridge-settings/inbox-test
 *
 * Sends a test email via outbound SMTP to the configured IMAP inbound address.
 * Validates the full outbound → inbound loop.
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getBridgeApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const bridgeUrl = getBridgeApiUrl();
    const resp = await fetch(`${bridgeUrl}/api/v1/test/imap-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    const payload = await resp.json().catch(() => ({}));

    if (!resp.ok || payload?.ok !== true) {
      const msg = payload?.detail || payload?.error || 'Send failed';
      return apiError(msg, 502);
    }

    return apiSuccess({ message: payload.message || 'Test email sent to inbound address.' });
  } catch (error) {
    console.error('[API] inbox-test failed:', error);
    return apiError('Failed to send test to inbound', 500);
  }
}
