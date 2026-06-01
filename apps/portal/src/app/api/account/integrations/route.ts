import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const response = await fetch(`${getAuthzBaseUrl()}/integrations`, {
      headers: { Authorization: `Bearer ${auth.sessionJwt}` },
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json(
        { success: false, error: `Failed to fetch integrations: ${message}` },
        { status: response.status }
      );
    }

    const integrations = await response.json();
    return NextResponse.json({ success: true, integrations });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch integrations');
  }
}
