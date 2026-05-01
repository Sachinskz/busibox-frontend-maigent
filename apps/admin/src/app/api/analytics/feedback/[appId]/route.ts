/**
 * GET /api/analytics/feedback/[appId]
 *
 * Returns full feedback history for a single app.
 *
 * Query params:
 *   from_date: ISO timestamp (optional)
 *   to_date: ISO timestamp (optional)
 *   limit: number (default 100)
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

    const sp = request.nextUrl.searchParams;
    const qs = new URLSearchParams();
    if (sp.get('from_date')) qs.set('from_date', sp.get('from_date')!);
    if (sp.get('to_date')) qs.set('to_date', sp.get('to_date')!);
    if (sp.get('limit')) qs.set('limit', sp.get('limit')!);

    const query = qs.toString() ? `?${qs}` : '';
    const res = await fetch(
      `${authzUrl}/admin/analytics/feedback/${encodeURIComponent(appId)}${query}`,
      { headers: { Authorization: `Bearer ${options.accessToken}` } },
    );

    if (!res.ok) {
      console.error('[analytics/feedback/[appId]] authz returned', res.status);
      return apiSuccess({
        app_id: appId,
        summary: { positive: 0, neutral: 0, negative: 0, total: 0, satisfaction_score: 0 },
        entries: [],
        weekly_trend: [],
      });
    }

    const data = await res.json();
    return apiSuccess(data);
  } catch (error) {
    const { handleApiError } = await import('@jazzmind/busibox-app/lib/next/middleware');
    return handleApiError(error, 'Failed to load app feedback detail');
  }
}
