/**
 * Feedback submission helper for busibox apps.
 *
 * Stores user satisfaction ratings and optional comments as authz audit
 * events (action: 'app.feedback.submitted').  Because feedback is stored
 * as audit events, it is admin-only readable (via the analytics endpoints)
 * and never exposed to regular users.
 *
 * Usage (server-side API route):
 * ```typescript
 * import { submitAppFeedback } from '@jazzmind/busibox-app/lib/authz/feedback';
 *
 * await submitAppFeedback({
 *   authzUrl: process.env.AUTHZ_BASE_URL!,
 *   accessToken: auth.apiToken,   // token exchanged to 'authz-api' audience
 *   appId: 'busibox-agents',
 *   actorId: user.sub,
 *   rating: 'positive',
 *   comment: 'Very helpful!',
 * });
 * ```
 */

const DEFAULT_AUTHZ_URL =
  process.env.AUTHZ_BASE_URL || process.env.AUTHZ_URL || 'http://authz-api:8010';

export type FeedbackRating = 'positive' | 'neutral' | 'negative';

export interface SubmitFeedbackParams {
  /** JWT access token scoped to 'authz-api' audience with authz.audit.write scope */
  accessToken: string;
  /** App identifier (e.g. 'busibox-agents', 'busibox-portal') */
  appId: string;
  /** User ID of the person submitting feedback */
  actorId: string;
  /** Satisfaction rating */
  rating: FeedbackRating;
  /** Optional free-text comment */
  comment?: string;
  /** Override authz service base URL */
  authzUrl?: string;
}

export interface FeedbackSubmitResult {
  success: boolean;
  auditLogId?: string;
  error?: string;
}

/**
 * Submit app satisfaction feedback as an authz audit event.
 *
 * This is a server-side helper — call it from a Next.js API route after
 * exchanging the user's token to the 'authz-api' audience.
 */
export async function submitAppFeedback(
  params: SubmitFeedbackParams,
): Promise<FeedbackSubmitResult> {
  const { accessToken, appId, actorId, rating, comment, authzUrl } = params;
  const base = authzUrl || DEFAULT_AUTHZ_URL;

  try {
    const res = await fetch(`${base}/audit/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        actor_id: actorId,
        action: 'app.feedback.submitted',
        resource_type: 'app',
        resource_id: appId,
        event_type: 'feedback',
        details: {
          app_id: appId,
          rating,
          comment: comment?.trim() || null,
          submitted_at: new Date().toISOString(),
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { success: false, error: `Authz returned ${res.status}: ${text}` };
    }

    const data = await res.json();
    return { success: true, auditLogId: data.audit_log_id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
