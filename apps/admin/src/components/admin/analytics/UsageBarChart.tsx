'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface DailyPoint {
  date: string;
  requests?: number;
  unique_users?: number;
  conversations?: number;
}

interface UsageBarChartProps {
  data: DailyPoint[];
  /** Which bars to show */
  bars?: Array<{
    key: string;
    label: string;
    color: string;
  }>;
  height?: number;
}

const DEFAULT_BARS = [
  { key: 'unique_users', label: 'Unique Users', color: '#6366f1' },
  { key: 'requests', label: 'Requests', color: '#22c55e' },
];

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function UsageBarChart({
  data,
  bars = DEFAULT_BARS,
  height = 220,
}: UsageBarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400 text-sm"
        style={{ height }}
      >
        No data available
      </div>
    );
  }

  const formatted = data.map((d) => ({ ...d, date: shortDate(d.date) }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {bars.map((b) => (
          <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={[3, 3, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
