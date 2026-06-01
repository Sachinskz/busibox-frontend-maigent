import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';

interface RouteParams {
  params: Promise<{ provider: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { provider } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const response = await fetch(`${getAuthzBaseUrl()}/integrations/${provider}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.sessionJwt}` },
    });

    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json(
        { success: false, error: `Failed to disconnect: ${message}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'Failed to disconnect integration');
  }
}
