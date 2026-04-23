import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import { exchangeWithSubjectToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    const { id: fileId } = await params;

    let tokenResult;
    try {
      tokenResult = await exchangeWithSubjectToken({
        sessionJwt,
        userId: user.id,
        audience: 'data-api',
      });
    } catch (exchangeError) {
      console.error('[admin/data/admin/files/delete] Token exchange failed:', exchangeError);
      return apiError('Token exchange failed', 401);
    }

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();

    const response = await fetch(
      `${dataApiUrl}/files/admin/${fileId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${tokenResult.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin/data/admin/files/delete] Data API error:', response.status, errorText);
      return apiError(`Failed to delete file: ${response.status}`, response.status);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[admin/data/admin/files/delete] Error:', error);
    return apiError('Internal server error', 500);
  }
}
