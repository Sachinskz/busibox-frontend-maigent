/**
 * GET /api/analytics/chat
 *
 * Returns per-app chat usage statistics from the agent-api
 * (conversation counts by source app).
 *
 * Query params:
 *   days: number (default 30)
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const agentApiUrl =
      process.env.AGENT_API_URL ||
      process.env.NEXT_PUBLIC_AGENT_API_URL ||
      'http://localhost:8000';

    const days = request.nextUrl.searchParams.get('days') || '30';

    try {
      const userId = getUserIdFromSessionJwt(sessionJwt);
      if (!userId) return apiSuccess({ apps: [], days: Number(days) });

      const tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId,
        audience: 'agent-api',
        purpose: 'admin-analytics',
      });

      const res = await fetch(
        `${agentApiUrl}/admin/stats/usage/by-app?days=${days}`,
        { headers: { Authorization: `Bearer ${tokenResult.accessToken}` } },
      );

      if (!res.ok) {
        console.error('[analytics/chat] agent-api returned', res.status);
        return apiSuccess({ apps: [], days: Number(days) });
      }

      const data = await res.json();
      return apiSuccess(data);
    } catch (err) {
      console.error('[analytics/chat] agent-api error:', err);
      return apiSuccess({ apps: [], days: Number(days) });
    }
  } catch (error) {
    const { handleApiError } = await import('@jazzmind/busibox-app/lib/next/middleware');
    return handleApiError(error, 'Failed to load chat analytics');
  }
}
