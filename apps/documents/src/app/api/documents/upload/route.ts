/**
 * Document Upload API Route
 * 
 * Proxies file uploads to the data-api (source of truth for documents).
 * Data-api handles storage, library association, and processing queue.
 */

import { NextRequest } from 'next/server';
import { requireAuth, apiError, apiSuccess } from '@jazzmind/busibox-app/lib/next/middleware';
import { dataFetch, setSessionJwtForUser } from '@jazzmind/busibox-app/lib/data/app-client';
import { canUploadToLibrary } from '@jazzmind/busibox-app/lib/data/libraries';
import { getDataApiTokenForSettings, getDataSettings } from '@jazzmind/busibox-app/lib/data/settings';
import { getResourceRoles, getUserRoles } from '@jazzmind/busibox-app';
import { getAuthzOptionsWithToken } from '@jazzmind/busibox-app/lib/authz/next-client';
import { getDataApiUrl } from '@jazzmind/busibox-app/lib/next/api-url';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof Response) {
      return authResult;
    }

    const { user, sessionJwt } = authResult;
    
    // Set session JWT for Zero Trust token exchange
    setSessionJwtForUser(user.id, sessionJwt);

    // Get form data from request
    const formData = await request.formData();
    const file = formData.get('file');
    const libraryIdParam = formData.get('libraryId');

    if (!file || !(file instanceof File)) {
      return apiError('No file provided', 400);
    }

    // Determine target library (if specified, validate permission)
    let libraryId: string | undefined;
    if (libraryIdParam && typeof libraryIdParam === 'string') {
      // Validate upload permission to specified library via data-api
      const canUpload = await canUploadToLibrary(user.id, libraryIdParam, sessionJwt);
      if (!canUpload) {
        return apiError('No permission to upload to specified library', 403);
      }
      libraryId = libraryIdParam;
    }
    // If no library specified, data-api will use/create user's default Personal library

    // Validate file size (100MB max)
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_FILE_SIZE) {
      return apiError('File size exceeds 100MB limit', 400);
    }

    // Validate file type
    const SUPPORTED_TYPES = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/msword', // DOC
      'text/plain',
      'text/markdown',
      'text/html',
      'text/csv',
      'application/json',
    ];

    if (!SUPPORTED_TYPES.includes(file.type)) {
      return apiError(`Unsupported file type: ${file.type}`, 400);
    }

    // Get data settings from data-api store
    const { accessToken: settingsToken } = await getDataApiTokenForSettings(user.id, sessionJwt);
    const settings = await getDataSettings(settingsToken);

    // For non-personal shared libraries, resolve authz role bindings so the
    // uploaded document gets visibility=shared + document_roles set correctly.
    let uploadVisibility: 'personal' | 'shared' = 'personal';
    let uploadRoleIds: string[] = [];

    if (libraryId) {
      const dataApiUrl = getDataApiUrl();
      const libResponse = await fetch(`${dataApiUrl}/libraries/${libraryId}`, {
        headers: { Authorization: `Bearer ${settingsToken}` },
      });

      if (libResponse.ok) {
        const libData = await libResponse.json();
        const targetLib = libData.data || libData;
        const isPersonal = targetLib.isPersonal ?? targetLib.is_personal ?? false;

        if (!isPersonal) {
          uploadVisibility = 'shared';
          const authzOptions = await getAuthzOptionsWithToken(sessionJwt);
          try {
            const roleBindings = await getResourceRoles('library', libraryId, authzOptions);
            uploadRoleIds = roleBindings.map((r: { id: string }) => r.id);
          } catch (e) {
            console.error('[API] Document upload - failed to get library roles:', e);
          }
          // Fall back to the user's own roles if the library has no explicit role bindings
          if (uploadRoleIds.length === 0) {
            try {
              const userRoles = await getUserRoles(user.id, authzOptions);
              uploadRoleIds = userRoles.map((r: { id: string }) => r.id);
            } catch (e) {
              console.error('[API] Document upload - failed to get user roles:', e);
            }
          }
          if (uploadRoleIds.length === 0) {
            return apiError('Unable to determine role bindings for the target library or the current user.', 400);
          }
        }
      }
    }

    // Forward to data-api
    const ingestFormData = new FormData();
    ingestFormData.append('file', file);
    
    // Add library ID if specified
    if (libraryId) {
      ingestFormData.append('library_id', libraryId);
    }

    // Propagate visibility and role_ids so documents in shared libraries are
    // immediately visible to all role-holders under PostgreSQL RLS.
    ingestFormData.append('visibility', uploadVisibility);
    if (uploadVisibility === 'shared' && uploadRoleIds.length > 0) {
      ingestFormData.append('role_ids', uploadRoleIds.join(','));
    }
    
    // Add metadata including processing options
    const metadata = JSON.stringify({
      source: 'web_upload',
      uploaded_by: user.email,
    });
    ingestFormData.append('metadata', metadata);

    // Add processing configuration from data settings
    const processingConfig = JSON.stringify({
      llm_cleanup_enabled: settings.llmCleanupEnabled,
      marker_enabled: settings.markerEnabled,
      entity_extraction_enabled: settings.entityExtractionEnabled,
      chunk_size_min: settings.chunkSizeMin,
      chunk_size_max: settings.chunkSizeMax,
      chunk_overlap_pct: settings.chunkOverlapPct,
    });
    ingestFormData.append('processing_config', processingConfig);

    const response = await dataFetch(
      `POST /api/documents/upload - upload document ${file.name}`,
      '/upload',
      {
        method: 'POST',
        body: ingestFormData,
        userId: user.id,  // Required for authz token exchange (RLS passthrough)
        timeout: 120000, // 2 minutes - upload includes encryption + MinIO storage
      }
    );

    const data = await response.json();

    // Document is now stored in data-api - no need to duplicate in portal database
    // Data-api is the source of truth for documents

    return apiSuccess({
      fileId: data.fileId,  // Return camelCase to match data service
      filename: data.filename || file.name,
      status: data.status || 'queued',
      sizeBytes: file.size,
      libraryId: data.libraryId || libraryId,
    });
  } catch (error: any) {
    console.error('[API] Document upload error:', error);
    
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
      return apiError('Data service is not available', 503);
    }

    return apiError(error.message || 'An unexpected error occurred', 500);
  }
}
