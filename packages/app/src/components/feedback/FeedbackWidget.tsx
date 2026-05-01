'use client';

/**
 * FeedbackWidget
 *
 * A weekly satisfaction prompt that asks "How well is this app working for
 * you?" with a smile / meh / frown rating plus an optional comment.
 *
 * Behaviour:
 * - Shows a discreet floating button at the bottom-right of the page.
 * - Automatically prompts once per 7 days per app (tracked in localStorage).
 * - On rating selection, expands to show an optional comment + submit button.
 * - Submits to the app's own `POST /api/feedback` route.
 *
 * Usage:
 * ```tsx
 * // In your app's root layout or authenticated layout
 * import { FeedbackWidget } from '@jazzmind/busibox-app';
 *
 * <FeedbackWidget appId="busibox-agents" />
 * ```
 *
 * The host app must expose `POST /api/feedback` that accepts:
 *   { rating: 'positive' | 'neutral' | 'negative', comment?: string }
 */

import { useState, useEffect, useCallback } from 'react';

export type FeedbackRating = 'positive' | 'neutral' | 'negative';

export interface FeedbackWidgetProps {
  /** App identifier used for localStorage key and submitted to the API */
  appId: string;
  /** API route to submit feedback to (defaults to /api/feedback) */
  submitUrl?: string;
  /** How many days between automatic prompts (default: 7) */
  promptIntervalDays?: number;
  /** Whether to suppress the automatic weekly prompt (still shows the button) */
  disableAutoPrompt?: boolean;
}

const EMOJI: Record<FeedbackRating, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😞',
};

const LABEL: Record<FeedbackRating, string> = {
  positive: 'Great',
  neutral: 'OK',
  negative: 'Not great',
};

const COLOR: Record<FeedbackRating, string> = {
  positive: 'bg-green-100 border-green-400 text-green-800 hover:bg-green-200',
  neutral: 'bg-yellow-100 border-yellow-400 text-yellow-800 hover:bg-yellow-200',
  negative: 'bg-red-100 border-red-400 text-red-800 hover:bg-red-200',
};

const SELECTED_COLOR: Record<FeedbackRating, string> = {
  positive: 'bg-green-500 border-green-600 text-white ring-2 ring-green-300',
  neutral: 'bg-yellow-500 border-yellow-600 text-white ring-2 ring-yellow-300',
  negative: 'bg-red-500 border-red-600 text-white ring-2 ring-red-300',
};

function localStorageKey(appId: string) {
  return `feedback_last_submitted_${appId}`;
}

function shouldAutoPrompt(appId: string, intervalDays: number): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(localStorageKey(appId));
  if (!raw) return true;
  const last = new Date(raw).getTime();
  const cutoff = Date.now() - intervalDays * 24 * 60 * 60 * 1000;
  return last < cutoff;
}

function markSubmitted(appId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(localStorageKey(appId), new Date().toISOString());
}

type WidgetState = 'hidden' | 'button' | 'open' | 'submitted';

export function FeedbackWidget({
  appId,
  submitUrl = '/api/feedback',
  promptIntervalDays = 7,
  disableAutoPrompt = false,
}: FeedbackWidgetProps) {
  const [state, setState] = useState<WidgetState>('hidden');
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Delay initialisation so it doesn't block first paint
    const timer = setTimeout(() => {
      if (!disableAutoPrompt && shouldAutoPrompt(appId, promptIntervalDays)) {
        setState('open');
      } else {
        setState('button');
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [appId, disableAutoPrompt, promptIntervalDays]);

  const handleRatingClick = useCallback((r: FeedbackRating) => {
    setRating(r);
    setError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!rating) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      markSubmitted(appId);
      setState('submitted');
      // Auto-hide after 3 s
      setTimeout(() => setState('button'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }, [rating, comment, appId, submitUrl]);

  const handleDismiss = useCallback(() => {
    markSubmitted(appId); // Don't prompt again for a week even if dismissed
    setState('button');
    setRating(null);
    setComment('');
    setError(null);
  }, [appId]);

  if (state === 'hidden') return null;

  // Compact floating button when not expanded
  if (state === 'button') {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setState('open')}
          className="flex items-center gap-2 rounded-full bg-white border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 shadow-md hover:shadow-lg hover:border-gray-300 transition-all"
          aria-label="Give feedback"
        >
          <span>💬</span>
          <span>Feedback</span>
        </button>
      </div>
    );
  }

  // Thank-you state
  if (state === 'submitted') {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <div className="flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-4 py-2 text-sm font-medium text-green-700 shadow-md">
          <span>✓</span>
          <span>Thanks for your feedback!</span>
        </div>
      </div>
    );
  }

  // Expanded panel
  return (
    <div className="fixed bottom-6 right-6 z-50 w-80">
      <div className="rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800">
            How well is this app working for you?
          </p>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 rounded p-0.5"
            aria-label="Close feedback"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Rating buttons */}
          <div className="flex gap-2 justify-center">
            {(['positive', 'neutral', 'negative'] as FeedbackRating[]).map(
              (r) => (
                <button
                  key={r}
                  onClick={() => handleRatingClick(r)}
                  className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                    rating === r ? SELECTED_COLOR[r] : COLOR[r]
                  }`}
                  aria-pressed={rating === r}
                  aria-label={LABEL[r]}
                >
                  <span className="text-2xl">{EMOJI[r]}</span>
                  <span>{LABEL[r]}</span>
                </button>
              ),
            )}
          </div>

          {/* Comment area — shown once a rating is selected */}
          {rating && (
            <div className="space-y-2">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Any comments? (optional)"
                rows={3}
                maxLength={500}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              />
              {error && (
                <p className="text-xs text-red-600">{error}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {submitting ? 'Sending…' : 'Send feedback'}
                </button>
                <button
                  onClick={handleDismiss}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
