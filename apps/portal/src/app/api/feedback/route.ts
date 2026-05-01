/**
 * POST /api/feedback
 *
 * Accepts a satisfaction rating from FeedbackWidget and stores it as an
 * authz audit event.
 *
 * Body: { rating: 'positive' | 'neutral' | 'negative', comment?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { submitAppFeedback, type FeedbackRating } from '@jazzmind/busibox-app/lib/authz/feedback';

const APP_ID = 'busibox-portal';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user, sessionJwt } = authResult;
    const body = await request.json();
    const { rating, comment } = body as { rating: FeedbackRating; comment?: string };

    if (!['positive', 'neutral', 'negative'].includes(rating)) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }

    const authzUrl = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';

    // Exchange session JWT for an authz-api-scoped token
    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId: user.id,
      audience: 'authz-api',
      purpose: 'submit-feedback',
    });

    const result = await submitAppFeedback({
      accessToken: tokenResult.accessToken,
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
  } catch (err) {
    console.error('[feedback] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
