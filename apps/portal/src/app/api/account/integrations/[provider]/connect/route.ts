import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAuthzBaseUrl } from '@jazzmind/busibox-app/lib/authz/next-client';

interface RouteParams {
  params: Promise<{ provider: string }>;
}

/**
 * GET /api/account/integrations/[provider]/connect
 *
 * Server-side OAuth initiation proxy.
 * 1. Validates the user's session JWT.
 * 2. Calls authz POST /integrations/{provider}/initiate (server-to-server).
 * 3. Redirects the browser to the OAuth provider's consent screen.
 *
 * The OAuth redirect_uri is configured in authz and points back to authz's
 * callback endpoint, which stores the tokens and redirects to the portal.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { provider } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const response = await fetch(`${getAuthzBaseUrl()}/integrations/${provider}/initiate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.sessionJwt}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json(
        { success: false, error: text || `Failed to initiate ${provider} integration` },
        { status: response.status }
      );
    }

    const { redirect_url } = await response.json();
    return NextResponse.redirect(redirect_url);
  } catch (error) {
    return handleApiError(error, 'Failed to initiate integration');
  }
}
