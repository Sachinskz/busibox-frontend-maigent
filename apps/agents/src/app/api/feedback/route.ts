/**
 * POST /api/feedback
 *
 * Accepts a satisfaction rating from FeedbackWidget and submits it to authz
 * as an audit event.
 *
 * Body: { rating: 'positive' | 'neutral' | 'negative', comment?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthWithTokenExchange } from '@jazzmind/busibox-app/lib/next/middleware';
import { submitAppFeedback, type FeedbackRating } from '@jazzmind/busibox-app/lib/authz/feedback';

const APP_ID = 'busibox-agents';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthWithTokenExchange(request, 'authz-api');
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { rating, comment } = body as { rating: FeedbackRating; comment?: string };

    if (!['positive', 'neutral', 'negative'].includes(rating)) {
      return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
    }

    const authzUrl = process.env.AUTHZ_BASE_URL || 'http://authz-api:8010';
    const result = await submitAppFeedback({
      accessToken: auth.apiToken,
      appId: APP_ID,
      actorId: auth.user.id,
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
