/**
 * GET /api/analytics/report
 *
 * Aggregates data from authz analytics + agent-api chat stats into a
 * single OKR-ready report payload.
 *
 * Query params:
 *   period: '7d' | '30d' | 'custom' (default '30d')
 *   from:   ISO timestamp (required when period=custom)
 *   to:     ISO timestamp (required when period=custom)
 */

import { NextRequest } from 'next/server';
import { requireAdminAuth, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthzOptionsWithToken, getAuthzBaseUrl, exchangeWithSubjectToken, getUserIdFromSessionJwt } from '@jazzmind/busibox-app/lib/authz/next-client';

function periodToDates(period: string, from?: string | null, to?: string | null) {
  const now = new Date();
  const toDate = to ? new Date(to) : now;

  if (period === 'custom' && from) {
    return { fromDate: new Date(from), toDate };
  }

  const days = period === '7d' ? 7 : 30;
  const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { fromDate, toDate };
}

function periodToPrevDates(fromDate: Date, toDate: Date) {
  const duration = toDate.getTime() - fromDate.getTime();
  return {
    prevFrom: new Date(fromDate.getTime() - duration),
    prevTo: fromDate,
  };
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt } = authResult;
    const sp = request.nextUrl.searchParams;
    const period = sp.get('period') || '30d';
    const { fromDate, toDate } = periodToDates(period, sp.get('from'), sp.get('to'));
    const { prevFrom, prevTo } = periodToPrevDates(fromDate, toDate);

    const options = await getAuthzOptionsWithToken(sessionJwt);
    const authzUrl = getAuthzBaseUrl();
    const agentApiUrl =
      process.env.AGENT_API_URL ||
      process.env.NEXT_PUBLIC_AGENT_API_URL ||
      'http://localhost:8000';

    const days = Math.ceil(
      (toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000),
    );

    const headers = { Authorization: `Bearer ${options.accessToken}` };

    // Fetch current period data
    const [appUsage, feedbackData, prevFeedbackData] = await Promise.all([
      fetch(
        `${authzUrl}/admin/analytics/apps?days=${days}`,
        { headers },
      ).then((r) => (r.ok ? r.json() : { apps: [] })).catch(() => ({ apps: [] })),

      fetch(
        `${authzUrl}/admin/analytics/feedback?from_date=${fromDate.toISOString()}&to_date=${toDate.toISOString()}`,
        { headers },
      ).then((r) => (r.ok ? r.json() : { feedback: [] })).catch(() => ({ feedback: [] })),

      fetch(
        `${authzUrl}/admin/analytics/feedback?from_date=${prevFrom.toISOString()}&to_date=${prevTo.toISOString()}`,
        { headers },
      ).then((r) => (r.ok ? r.json() : { feedback: [] })).catch(() => ({ feedback: [] })),
    ]);

    // Fetch chat stats from agent-api
    let chatData: { apps?: unknown[] } = { apps: [] };
    try {
      const userId = getUserIdFromSessionJwt(sessionJwt);
      if (userId) {
        const tokenResult = await exchangeWithSubjectToken({
          sessionJwt,
          userId,
          audience: 'agent-api',
          purpose: 'admin-analytics-report',
        });
        const chatRes = await fetch(
          `${agentApiUrl}/admin/stats/usage/by-app?days=${days}`,
          { headers: { Authorization: `Bearer ${tokenResult.accessToken}` } },
        );
        if (chatRes.ok) chatData = await chatRes.json();
      }
    } catch (_err) {
      // Chat data is optional
    }

    // Index feedback by app_id for quick lookup
    interface FeedbackEntry {
      app_id: string;
      positive: number;
      neutral: number;
      negative: number;
      total: number;
      satisfaction_score: number;
    }
    const feedbackByApp = new Map<string, FeedbackEntry>(
      (feedbackData.feedback || []).map((f: FeedbackEntry) => [f.app_id, f]),
    );
    const prevFeedbackByApp = new Map<string, FeedbackEntry>(
      (prevFeedbackData.feedback || []).map((f: FeedbackEntry) => [f.app_id, f]),
    );

    interface AppUsageEntry {
      app_id: string;
      requests_today: number;
      requests_7d: number;
      requests_30d: number;
      unique_users_today: number;
      unique_users_7d: number;
      unique_users_30d: number;
      daily_trend: Array<{ date: string; requests: number; unique_users: number }>;
    }

    interface ChatAppEntry {
      app_id: string;
      conversations_total: number;
      conversations_7d: number;
      unique_users_total: number;
      messages_total: number;
      avg_messages_per_conversation: number;
      daily_trend: Array<{ date: string; conversations: number; unique_users: number }>;
    }

    const chatByApp = new Map<string, ChatAppEntry>(
      ((chatData.apps || []) as ChatAppEntry[]).map((a) => [a.app_id, a]),
    );

    // Build per-app report entries
    const allAppIds = new Set([
      ...((appUsage.apps || []) as AppUsageEntry[]).map((a) => a.app_id),
      ...Array.from(feedbackByApp.keys()),
    ]);

    const appReports = Array.from(allAppIds).map((appId) => {
      const usage = (appUsage.apps || []).find((a: AppUsageEntry) => a.app_id === appId) as AppUsageEntry | undefined;
      const feedback = feedbackByApp.get(appId);
      const prevFeedback = prevFeedbackByApp.get(appId);
      const chat = chatByApp.get(appId);

      const satisfactionScore = feedback?.satisfaction_score ?? null;
      const prevSatisfactionScore = prevFeedback?.satisfaction_score ?? null;
      const satisfactionTrend =
        satisfactionScore !== null && prevSatisfactionScore !== null
          ? satisfactionScore - prevSatisfactionScore
          : null;

      // Requests per user (engagement metric)
      const requestsPerUser =
        usage && usage.unique_users_30d > 0
          ? Math.round((usage.requests_30d / usage.unique_users_30d) * 10) / 10
          : 0;

      return {
        app_id: appId,
        adoption: {
          unique_users: usage?.unique_users_30d ?? 0,
          unique_users_7d: usage?.unique_users_7d ?? 0,
          unique_users_today: usage?.unique_users_today ?? 0,
          total_requests: usage?.requests_30d ?? 0,
          daily_trend: usage?.daily_trend ?? [],
        },
        engagement: {
          requests_per_user: requestsPerUser,
          conversations: chat?.conversations_total ?? 0,
          avg_messages_per_conversation: chat?.avg_messages_per_conversation ?? 0,
          chat_daily_trend: chat?.daily_trend ?? [],
        },
        satisfaction: {
          positive: feedback?.positive ?? 0,
          neutral: feedback?.neutral ?? 0,
          negative: feedback?.negative ?? 0,
          total_responses: feedback?.total ?? 0,
          score: satisfactionScore,
          trend: satisfactionTrend,
        },
      };
    });

    // Overall totals
    const totals = appReports.reduce(
      (acc, app) => ({
        uniqueUsers: acc.uniqueUsers + app.adoption.unique_users,
        totalRequests: acc.totalRequests + app.adoption.total_requests,
        feedbackResponses: acc.feedbackResponses + app.satisfaction.total_responses,
        positiveResponses: acc.positiveResponses + app.satisfaction.positive,
        negativeResponses: acc.negativeResponses + app.satisfaction.negative,
      }),
      {
        uniqueUsers: 0,
        totalRequests: 0,
        feedbackResponses: 0,
        positiveResponses: 0,
        negativeResponses: 0,
      },
    );

    const overallSatisfactionScore =
      totals.feedbackResponses > 0
        ? Math.round(
            ((totals.positiveResponses - totals.negativeResponses) /
              totals.feedbackResponses) *
              100 *
              10,
          ) / 10
        : null;

    return apiSuccess({
      period: {
        label: period,
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        days,
      },
      summary: {
        ...totals,
        overallSatisfactionScore,
      },
      apps: appReports,
    });
  } catch (error) {
    const { handleApiError } = await import('@jazzmind/busibox-app/lib/next/middleware');
    return handleApiError(error, 'Failed to generate OKR report');
  }
}
