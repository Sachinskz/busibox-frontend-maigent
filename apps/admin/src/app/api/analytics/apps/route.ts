/**
 * GET /api/analytics/apps
 *
 * Returns per-app usage summary from authz (oauth.token.issued aggregates).
 *
 * Query params:
 *   days: number (default 30)
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthzOptionsWithToken, getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const options = await getAuthzOptionsWithToken(sessionJwt);
    const authzUrl = getAuthzBaseUrl();

    const days = request.nextUrl.searchParams.get('days') || '30';

    const res = await fetch(
      `${authzUrl}/admin/analytics/apps?days=${days}`,
      { headers: { Authorization: `Bearer ${options.accessToken}` } },
    );

    if (!res.ok) {
      console.error('[analytics/apps] authz returned', res.status);
      return apiSuccess({ apps: [] });
    }

    const data = await res.json();
    return apiSuccess(data);
  } catch (error) {
    const { handleApiError } = await import('@jazzmind/busibox-app/lib/next/middleware');
    return handleApiError(error, 'Failed to load app usage data');
  }
}
