/**
 * Admin Library Documents API Route
 *
 * GET:    List files inside a library (proxies to data-api /libraries/{id}/documents)
 * DELETE: Delete a specific document from a library (?docId=<fileId>)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, apiSuccess, apiError } from '@jazzmind/busibox-app/lib/next/middleware';
import {
  exchangeWithSubjectToken,
  getUserIdFromSessionJwt,
} from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { sessionJwt } = authResult;
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) return apiError('Invalid session', 401);

    const { id } = await params;
    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId,
      audience: 'data-api',
      scopes: ['data:read'],
      purpose: 'admin-library-documents',
    });

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();

    const response = await fetch(
      `${dataApiUrl}/libraries/${id}/documents${qs ? `?${qs}` : ''}`,
      {
        headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin/libraries/documents] Data API error:', response.status, errorText);
      return apiError(`Failed to fetch library documents: ${response.status}`, response.status);
    }

    const data = await response.json();
    return apiSuccess(data);
  } catch (error) {
    console.error('[admin/libraries/documents] Error:', error);
    return apiError('Internal server error', 500);
  }
}

/**
 * DELETE /api/libraries/[id]/documents?docId=<fileId>
 *
 * Deletes a single file from a library using the data-api admin delete endpoint.
 * Tries admin delete first; falls back to standard delete (which enforces ownership).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { sessionJwt } = authResult;
    const userId = getUserIdFromSessionJwt(sessionJwt);
    if (!userId) return apiError('Invalid session', 401);

    const docId = new URL(request.url).searchParams.get('docId');
    if (!docId) return apiError('docId query param is required', 400);

    const tokenResult = await exchangeWithSubjectToken({
      sessionJwt,
      userId,
      audience: 'data-api',
      purpose: 'admin-library-document-delete',
    });

    if (!tokenResult?.accessToken) {
      return apiError('Token exchange failed', 401);
    }

    const dataApiUrl = getDataApiUrl();

    // Try admin endpoint first (bypasses ownership RLS, requires data.admin scope)
    const adminUrl = `${dataApiUrl}/files/admin/${docId}`;
    console.log('[admin/libraries/documents/delete] Trying admin delete:', adminUrl);
    const adminRes = await fetch(adminUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
    });

    if (adminRes.ok) {
      return apiSuccess({ deleted: true, fileId: docId });
    }

    const adminBody = await adminRes.text();
    const adminStatus = adminRes.status;
    console.warn(
      '[admin/libraries/documents/delete] Admin delete failed:',
      adminStatus,
      adminBody,
    );

    // Fallback: try standard delete (works if admin owns the file)
    const standardUrl = `${dataApiUrl}/files/${docId}`;
    console.log('[admin/libraries/documents/delete] Trying standard delete:', standardUrl);
    const stdRes = await fetch(standardUrl, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
    });

    if (stdRes.ok) {
      return apiSuccess({ deleted: true, fileId: docId });
    }

    const stdBody = await stdRes.text();
    const stdStatus = stdRes.status;
    console.error(
      '[admin/libraries/documents/delete] Standard delete also failed:',
      stdStatus,
      stdBody,
    );

    // {"detail":"Not Found"} is FastAPI's generic 404 when no route matches.
    // This means the admin delete endpoint hasn't been deployed to production yet.
    const adminRouteNotDeployed =
      adminStatus === 404 && adminBody.includes('"Not Found"');

    if (adminRouteNotDeployed) {
      return apiError(
        'Cannot delete this file: the data service needs to be redeployed to enable admin file deletion. ' +
          'Run `make manage SERVICE=data ACTION=redeploy` from the busibox repo, then try again.',
        503,
      );
    }

    if (adminStatus === 403) {
      return apiError(
        'Cannot delete this file: the admin token is missing the data.admin scope. ' +
          'Ensure the Admin role has data.admin (or data.*) scope in authz, then try again.',
        403,
      );
    }

    return apiError(
      `Failed to delete file. The record may be orphaned or corrupted. ` +
        `(admin: ${adminStatus}, standard: ${stdStatus})`,
      adminStatus,
    );
  } catch (error) {
    console.error('[admin/libraries/documents/delete] Error:', error);
    return apiError('Internal server error', 500);
  }
}
