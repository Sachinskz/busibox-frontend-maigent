/**
 * GET /api/analytics/apps/[appId]
 *
 * Returns detailed usage for a single app: daily breakdown, hourly
 * distribution, and top users.
 *
 * Query params:
 *   days: number (default 30)
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthzOptionsWithToken, getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';

interface RouteParams {
  params: Promise<{ appId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { appId } = await params;
    const { sessionJwt } = authResult;
    const options = await getAuthzOptionsWithToken(sessionJwt);
    const authzUrl = getAuthzBaseUrl();

    const days = request.nextUrl.searchParams.get('days') || '30';

    const res = await fetch(
      `${authzUrl}/admin/analytics/apps/${encodeURIComponent(appId)}?days=${days}`,
      { headers: { Authorization: `Bearer ${options.accessToken}` } },
    );

    if (!res.ok) {
      console.error('[analytics/apps/[appId]] authz returned', res.status);
      return apiSuccess({
        app_id: appId,
        daily_active_users: [],
        hourly_distribution: [],
        top_users: [],
      });
    }

    const data = await res.json();
    return apiSuccess(data);
  } catch (error) {
    const { handleApiError } = await import('@jazzmind/busibox-app/lib/next/middleware');
    return handleApiError(error, 'Failed to load app usage detail');
  }
}
