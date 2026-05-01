'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Copy, Check } from 'lucide-react';
import { SatisfactionBadge } from '@/components/admin/analytics/SatisfactionBadge';

type Period = '7d' | '30d' | 'custom';

interface AppReport {
  app_id: string;
  adoption: {
    unique_users: number;
    unique_users_7d: number;
    unique_users_today: number;
    total_requests: number;
  };
  engagement: {
    requests_per_user: number;
    conversations: number;
    avg_messages_per_conversation: number;
  };
  satisfaction: {
    positive: number;
    neutral: number;
    negative: number;
    total_responses: number;
    score: number | null;
    trend: number | null;
  };
}

interface ReportData {
  period: { label: string; from: string; to: string; days: number };
  summary: {
    uniqueUsers: number;
    totalRequests: number;
    feedbackResponses: number;
    positiveResponses: number;
    negativeResponses: number;
    overallSatisfactionScore: number | null;
  };
  apps: AppReport[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function generateMarkdown(data: ReportData): string {
  const { period, summary, apps } = data;
  const periodLabel = period.label === '7d' ? 'Last 7 Days' : period.label === '30d' ? 'Last 30 Days' : `${formatDate(period.from)} – ${formatDate(period.to)}`;

  const lines: string[] = [
    `# App Usage & Satisfaction OKR Report`,
    `**Period:** ${periodLabel} (${formatDate(period.from)} – ${formatDate(period.to)})`,
    ``,
    `## Summary`,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Unique Users | ${summary.uniqueUsers.toLocaleString()} |`,
    `| Total Requests | ${summary.totalRequests.toLocaleString()} |`,
    `| Feedback Responses | ${summary.feedbackResponses} |`,
    `| Overall Satisfaction Score | ${summary.overallSatisfactionScore !== null ? `${summary.overallSatisfactionScore > 0 ? '+' : ''}${summary.overallSatisfactionScore}` : '—'} |`,
    ``,
    `## Per-App Breakdown`,
    ``,
    `| App | Unique Users | Requests | Conversations | Req/User | Satisfaction | Feedback |`,
    `|-----|-------------|----------|---------------|----------|-------------|----------|`,
    ...apps.map((a) =>
      `| ${a.app_id} | ${a.adoption.unique_users} | ${a.adoption.total_requests.toLocaleString()} | ${a.engagement.conversations} | ${a.engagement.requests_per_user} | ${a.satisfaction.score !== null ? `${a.satisfaction.score > 0 ? '+' : ''}${a.satisfaction.score}` : '—'} | ${a.satisfaction.total_responses} responses |`,
    ),
    ``,
    `## Satisfaction Details`,
    ``,
    ...apps
      .filter((a) => a.satisfaction.total_responses > 0)
      .map(
        (a) =>
          `**${a.app_id}**: 😊 ${a.satisfaction.positive} great · 😐 ${a.satisfaction.neutral} ok · 😞 ${a.satisfaction.negative} poor (score: ${a.satisfaction.score !== null ? `${a.satisfaction.score > 0 ? '+' : ''}${a.satisfaction.score}` : '—'})`,
      ),
    ``,
    `---`,
    `_Generated ${new Date().toLocaleString()}_`,
  ];

  return lines.join('\n');
}

function generateCsv(data: ReportData): string {
  const headers = [
    'App',
    'Unique Users (Period)',
    'Unique Users (7d)',
    'Unique Users (Today)',
    'Total Requests',
    'Conversations',
    'Avg Msgs/Conv',
    'Requests/User',
    'Feedback Total',
    'Positive',
    'Neutral',
    'Negative',
    'Satisfaction Score',
  ].join(',');

  const rows = data.apps.map((a) =>
    [
      a.app_id,
      a.adoption.unique_users,
      a.adoption.unique_users_7d,
      a.adoption.unique_users_today,
      a.adoption.total_requests,
      a.engagement.conversations,
      a.engagement.avg_messages_per_conversation,
      a.engagement.requests_per_user,
      a.satisfaction.total_responses,
      a.satisfaction.positive,
      a.satisfaction.neutral,
      a.satisfaction.negative,
      a.satisfaction.score !== null ? a.satisfaction.score : '',
    ].join(','),
  );

  return [headers, ...rows].join('\n');
}

export default function OKRReportPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = `/api/analytics/report?period=${period}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setData(json.data ?? json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCopyMarkdown = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(generateMarkdown(data));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCsv = () => {
    if (!data) return;
    const csv = generateCsv(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `okr-report-${period}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
            <h1 className="text-2xl font-bold text-gray-900">OKR Report</h1>
            <p className="text-sm text-gray-500">
              Adoption, engagement, and satisfaction metrics
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={handleCopyMarkdown}
            disabled={!data || loading}
            className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Markdown'}
          </button>
          <button
            onClick={handleDownloadCsv}
            disabled={!data || loading}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-gray-400">Generating report…</div>
      ) : !data ? (
        <div className="py-16 text-center text-gray-400">Failed to load report data.</div>
      ) : (
        <>
          {/* Period info */}
          <div className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
            Period: <strong>{formatDate(data.period.from)}</strong> –{' '}
            <strong>{formatDate(data.period.to)}</strong> ({data.period.days} days)
          </div>

          {/* Summary */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Summary</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-gray-100">
              {[
                { label: 'Unique Users', value: data.summary.uniqueUsers.toLocaleString() },
                { label: 'Total Requests', value: data.summary.totalRequests.toLocaleString() },
                { label: 'Feedback Responses', value: data.summary.feedbackResponses },
                {
                  label: 'Overall Satisfaction',
                  value:
                    data.summary.overallSatisfactionScore !== null ? (
                      <SatisfactionBadge
                        score={data.summary.overallSatisfactionScore}
                        size="lg"
                      />
                    ) : (
                      '—'
                    ),
                },
                { label: 'Positive Feedback', value: data.summary.positiveResponses },
                { label: 'Negative Feedback', value: data.summary.negativeResponses },
              ].map((item) => (
                <div key={item.label} className="bg-white px-6 py-5">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                    {item.label}
                  </p>
                  <p className="text-xl font-bold text-gray-900">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Adoption */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Adoption</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Unique users interacting with each app
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-6 py-3 font-medium">App</th>
                    <th className="px-4 py-3 font-medium text-right">Today</th>
                    <th className="px-4 py-3 font-medium text-right">7d</th>
                    <th className="px-4 py-3 font-medium text-right">Period</th>
                    <th className="px-4 py-3 font-medium text-right">Requests</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.apps.map((a) => (
                    <tr key={a.app_id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{a.app_id}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {a.adoption.unique_users_today}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {a.adoption.unique_users_7d}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-800">
                        {a.adoption.unique_users}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {a.adoption.total_requests.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Engagement */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Engagement</h2>
              <p className="text-xs text-gray-400 mt-0.5">Chat and request engagement depth</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-6 py-3 font-medium">App</th>
                    <th className="px-4 py-3 font-medium text-right">Req / User</th>
                    <th className="px-4 py-3 font-medium text-right">Conversations</th>
                    <th className="px-4 py-3 font-medium text-right">Avg Msgs / Conv</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.apps.map((a) => (
                    <tr key={a.app_id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{a.app_id}</td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {a.engagement.requests_per_user}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {a.engagement.conversations}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {a.engagement.avg_messages_per_conversation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Satisfaction */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800">Satisfaction</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Score = (positive − negative) / total × 100
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-6 py-3 font-medium">App</th>
                    <th className="px-4 py-3 font-medium text-right">😊 Great</th>
                    <th className="px-4 py-3 font-medium text-right">😐 OK</th>
                    <th className="px-4 py-3 font-medium text-right">😞 Poor</th>
                    <th className="px-4 py-3 font-medium text-right">Responses</th>
                    <th className="px-4 py-3 font-medium text-right">Score</th>
                    <th className="px-4 py-3 font-medium text-right">vs Prior</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.apps.map((a) => (
                    <tr key={a.app_id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{a.app_id}</td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        {a.satisfaction.positive}
                      </td>
                      <td className="px-4 py-3 text-right text-yellow-600">
                        {a.satisfaction.neutral}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        {a.satisfaction.negative}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {a.satisfaction.total_responses}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <SatisfactionBadge score={a.satisfaction.score} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {a.satisfaction.trend !== null ? (
                          <span
                            className={`text-xs font-medium ${
                              a.satisfaction.trend > 0
                                ? 'text-green-600'
                                : a.satisfaction.trend < 0
                                ? 'text-red-600'
                                : 'text-gray-400'
                            }`}
                          >
                            {a.satisfaction.trend > 0 ? '+' : ''}
                            {a.satisfaction.trend}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
