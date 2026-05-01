'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Users, MessageSquare, Clock } from 'lucide-react';
import { UsageBarChart } from '@/components/admin/analytics/UsageBarChart';
import { SatisfactionChart } from '@/components/admin/analytics/SatisfactionChart';
import { SatisfactionBadge } from '@/components/admin/analytics/SatisfactionBadge';

interface AppDetail {
  app_id: string;
  daily_active_users: Array<{ date: string; unique_users: number; requests: number }>;
  hourly_distribution: Array<{ hour: number; requests: number }>;
  top_users: Array<{ user_id: string; requests: number }>;
}

interface FeedbackDetail {
  app_id: string;
  summary: {
    positive: number;
    neutral: number;
    negative: number;
    total: number;
    satisfaction_score: number;
  };
  entries: Array<{
    id: string;
    actor_id: string;
    rating: string;
    comment: string | null;
    created_at: string;
  }>;
  weekly_trend: Array<{ week: string; positive: number; neutral: number; negative: number }>;
}

const RATING_EMOJI: Record<string, string> = {
  positive: '😊',
  neutral: '😐',
  negative: '😞',
};

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-3">
      <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

interface PageProps {
  params: Promise<{ appId: string }>;
}

export default function AppDetailPage({ params }: PageProps) {
  const { appId } = use(params);
  const decodedAppId = decodeURIComponent(appId);

  const [detail, setDetail] = useState<AppDetail | null>(null);
  const [feedback, setFeedback] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/analytics/apps/${encodeURIComponent(decodedAppId)}?days=${days}`).then(
        (r) => (r.ok ? r.json() : null),
      ),
      fetch(`/api/analytics/feedback/${encodeURIComponent(decodedAppId)}`).then(
        (r) => (r.ok ? r.json() : null),
      ),
    ])
      .then(([d, f]) => {
        setDetail(d);
        setFeedback(f);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [decodedAppId, days]);

  const totalRequests = detail?.daily_active_users.reduce((s, d) => s + d.requests, 0) ?? 0;
  const totalUsers = detail?.daily_active_users.reduce((s, d) => s + d.unique_users, 0) ?? 0;
  const avgDailyUsers =
    detail && detail.daily_active_users.length > 0
      ? Math.round(totalUsers / detail.daily_active_users.length)
      : 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/analytics"
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{decodedAppId}</h1>
            <p className="text-sm text-gray-500">App usage & satisfaction detail</p>
          </div>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">Loading…</div>
      ) : (
        <>
          {/* Usage Stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label="Avg Daily Users"
              value={avgDailyUsers}
            />
            <StatCard
              icon={<MessageSquare className="w-5 h-5" />}
              label="Total Requests"
              value={totalRequests.toLocaleString()}
            />
            <StatCard
              icon={<Clock className="w-5 h-5" />}
              label="Satisfaction"
              value={
                feedback?.summary.satisfaction_score !== undefined ? (
                  `${feedback.summary.satisfaction_score > 0 ? '+' : ''}${feedback.summary.satisfaction_score}`
                ) : '—'
              }
            />
          </div>

          {/* Daily Usage Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Daily Active Users & Requests</h2>
            <UsageBarChart
              data={detail?.daily_active_users ?? []}
              bars={[
                { key: 'unique_users', label: 'Unique Users', color: '#6366f1' },
                { key: 'requests', label: 'Requests', color: '#22c55e' },
              ]}
              height={220}
            />
          </div>

          {/* Hourly Distribution */}
          {detail && detail.hourly_distribution.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">
                Hourly Request Distribution
              </h2>
              <UsageBarChart
                data={detail.hourly_distribution.map((h) => ({
                  date: `${String(h.hour).padStart(2, '0')}:00`,
                  requests: h.requests,
                }))}
                bars={[{ key: 'requests', label: 'Requests', color: '#a78bfa' }]}
                height={160}
              />
            </div>
          )}

          {/* Satisfaction */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Weekly Satisfaction</h2>
              {feedback ? (
                <>
                  <div className="flex items-center gap-6 mb-4 text-sm">
                    <span className="text-green-600 font-medium">
                      😊 {feedback.summary.positive} great
                    </span>
                    <span className="text-yellow-600 font-medium">
                      😐 {feedback.summary.neutral} ok
                    </span>
                    <span className="text-red-600 font-medium">
                      😞 {feedback.summary.negative} poor
                    </span>
                    <SatisfactionBadge
                      score={feedback.summary.satisfaction_score}
                      size="sm"
                    />
                  </div>
                  <SatisfactionChart data={feedback.weekly_trend} height={160} />
                </>
              ) : (
                <p className="text-gray-400 text-sm">No feedback data yet</p>
              )}
            </div>

            {/* Recent Comments */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Recent Feedback</h2>
              {feedback && feedback.entries.length > 0 ? (
                <div className="space-y-3">
                  {feedback.entries.slice(0, 8).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-gray-50"
                    >
                      <span className="text-lg flex-shrink-0">
                        {RATING_EMOJI[e.rating] ?? '❓'}
                      </span>
                      <div className="min-w-0">
                        {e.comment ? (
                          <p className="text-sm text-gray-700">{e.comment}</p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">No comment</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(e.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">No feedback submitted yet</p>
              )}
            </div>
          </div>

          {/* Top Users */}
          {detail && detail.top_users.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Top Users</h2>
              <div className="space-y-2">
                {detail.top_users.slice(0, 10).map((u, i) => (
                  <div key={u.user_id} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
                    <div className="flex-1 bg-gray-100 rounded-full overflow-hidden h-5">
                      <div
                        className="h-full bg-indigo-400 rounded-full"
                        style={{
                          width: `${Math.min(
                            100,
                            (u.requests / (detail.top_users[0]?.requests || 1)) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 font-mono truncate max-w-[160px]">
                      {u.user_id}
                    </span>
                    <span className="text-xs text-gray-700 font-semibold w-8 text-right">
                      {u.requests}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
