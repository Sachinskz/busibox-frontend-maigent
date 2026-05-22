/**
 * Per-app environment variables API
 *
 * GET  /api/apps/[appId]/env-vars - List all env vars (decrypted) and manifest declarations
 * PUT  /api/apps/[appId]/env-vars - Replace all env vars (sync: upsert new, delete removed)
 * DELETE /api/apps/[appId]/env-vars/[varName] is handled via PUT with the var omitted
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@jazzmind/busibox-app/lib/next/middleware';
import { getAppConfigById } from '@jazzmind/busibox-app/lib/deploy/app-config';
import {
  getAppEnvVars,
  syncAppEnvVars,
} from '@jazzmind/busibox-app/lib/deploy/app-config';
import { getConfigApiToken } from '@jazzmind/busibox-app/lib/config/client';
import { fetchAndValidateManifest } from '@jazzmind/busibox-app/lib/deploy/github-manifest';
import { isGitHubUrl } from '@jazzmind/busibox-app/lib/deploy/github-manifest';

type Params = { params: Promise<{ appId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    const { appId } = await params;

    const [app, configToken] = await Promise.all([
      getAppConfigById({ userId: adminUser.id, sessionJwt }, appId),
      getConfigApiToken(adminUser.id, sessionJwt),
    ]);

    if (!app) {
      return NextResponse.json({ success: false, error: 'App not found' }, { status: 404 });
    }

    const vars = await getAppEnvVars(configToken, appId);

    // Fetch manifest to expose declared required/optional vars
    let requiredEnvVars: string[] = [];
    let optionalEnvVars: string[] = [];
    try {
      if (app.url && isGitHubUrl(app.url)) {
        const result = await fetchAndValidateManifest(app.url, app.githubToken || undefined);
        if (result.valid && result.manifest) {
          requiredEnvVars = result.manifest.requiredEnvVars ?? [];
          optionalEnvVars = result.manifest.optionalEnvVars ?? [];
        }
      }
    } catch {
      // Non-fatal — manifest not always fetchable (e.g. local dev, private repo without token)
    }

    return NextResponse.json({
      success: true,
      data: {
        vars,
        manifest: { requiredEnvVars, optionalEnvVars },
      },
    });
  } catch (error) {
    console.error('[API/env-vars GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const authResult = await requireAdminAuth(request);
    if (authResult instanceof Response) return authResult;

    const { user: adminUser, sessionJwt } = authResult;
    const { appId } = await params;

    let vars: Record<string, string>;
    try {
      const body = await request.json();
      if (!body || typeof body.vars !== 'object' || Array.isArray(body.vars)) {
        return NextResponse.json(
          { success: false, error: 'Request body must be { vars: { KEY: value, ... } }' },
          { status: 400 },
        );
      }
      // Validate all values are strings
      vars = {};
      for (const [k, v] of Object.entries(body.vars as Record<string, unknown>)) {
        if (typeof v !== 'string') {
          return NextResponse.json(
            { success: false, error: `Value for ${k} must be a string` },
            { status: 400 },
          );
        }
        // Ignore empty strings — treat as deletion
        if (v.trim() !== '') {
          vars[k] = v;
        }
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }

    const [app, configToken] = await Promise.all([
      getAppConfigById({ userId: adminUser.id, sessionJwt }, appId),
      getConfigApiToken(adminUser.id, sessionJwt),
    ]);

    if (!app) {
      return NextResponse.json({ success: false, error: 'App not found' }, { status: 404 });
    }

    await syncAppEnvVars(configToken, appId, vars);

    return NextResponse.json({ success: true, data: { saved: Object.keys(vars).length } });
  } catch (error) {
    console.error('[API/env-vars PUT] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
