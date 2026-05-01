/**
 * GET /api/analytics/feedback
 *
 * Returns aggregated satisfaction feedback from authz audit events.
 *
 * Query params:
 *   app_id: string (optional)
 *   from_date: ISO timestamp (optional)
 *   to_date: ISO timestamp (optional)
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthzOptionsWithToken, getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const options = await getAuthzOptionsWithToken(sessionJwt);
    const authzUrl = getAuthzBaseUrl();

    const sp = request.nextUrl.searchParams;
    const params = new URLSearchParams();
    if (sp.get('app_id')) params.set('app_id', sp.get('app_id')!);
    if (sp.get('from_date')) params.set('from_date', sp.get('from_date')!);
    if (sp.get('to_date')) params.set('to_date', sp.get('to_date')!);

    const query = params.toString() ? `?${params}` : '';
    const res = await fetch(
      `${authzUrl}/admin/analytics/feedback${query}`,
      { headers: { Authorization: `Bearer ${options.accessToken}` } },
    );

    if (!res.ok) {
      console.error('[analytics/feedback] authz returned', res.status);
      return apiSuccess({ feedback: [] });
    }

    const data = await res.json();
    return apiSuccess(data);
  } catch (error) {
    const { handleApiError } = await import('@jazzmind/busibox-app/lib/next/middleware');
    return handleApiError(error, 'Failed to load feedback data');
  }
}
