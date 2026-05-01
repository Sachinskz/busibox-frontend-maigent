/**
 * POST /api/feedback
 *
 * Accepts a satisfaction rating from the FeedbackWidget and stores it as
 * an authz audit event via the feedback helper.
 *
 * Body: { rating: 'positive' | 'neutral' | 'negative', comment?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthzOptionsWithToken, getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';
import { submitAppFeedback, type FeedbackRating } from '@jazzmind/busibox-app/lib/authz/feedback';

const APP_ID = 'busibox-admin';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { sessionJwt, user } = authResult;
    const options = await getAuthzOptionsWithToken(sessionJwt);
    const authzUrl = getAuthzBaseUrl();

    const body = await request.json();
    const { rating, comment } = body as { rating: FeedbackRating; comment?: string };

    if (!['positive', 'neutral', 'negative'].includes(rating)) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }

    const result = await submitAppFeedback({
      accessToken: options.accessToken,
      appId: APP_ID,
      actorId: user.id,
      rating,
      comment,
      authzUrl,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, auditLogId: result.auditLogId });
  } catch (error) {
    console.error('[feedback] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
