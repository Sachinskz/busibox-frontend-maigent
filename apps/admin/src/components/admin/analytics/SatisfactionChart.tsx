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

interface WeeklyPoint {
  week: string;
  positive: number;
  neutral: number;
  negative: number;
}

interface SatisfactionChartProps {
  data: WeeklyPoint[];
  height?: number;
}

function shortWeek(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function SatisfactionChart({ data, height = 200 }: SatisfactionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400 text-sm"
        style={{ height }}
      >
        No feedback data yet
      </div>
    );
  }

  const formatted = data.map((d) => ({ ...d, week: shortWeek(d.week) }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={formatted} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
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
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="positive" name="😊 Great" fill="#22c55e" stackId="stack" radius={[0, 0, 0, 0]} />
        <Bar dataKey="neutral" name="😐 OK" fill="#f59e0b" stackId="stack" />
        <Bar dataKey="negative" name="😞 Poor" fill="#ef4444" stackId="stack" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
