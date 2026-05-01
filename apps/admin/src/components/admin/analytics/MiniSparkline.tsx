'use client';

/**
 * Tiny inline SVG sparkline for trend data in table cells.
 * No external dependency — just a simple polyline.
 */

interface SparklinePoint {
  value: number;
}

interface MiniSparklineProps {
  data: SparklinePoint[];
  width?: number;
  height?: number;
  color?: string;
}

export function MiniSparkline({
  data,
  width = 80,
  height = 24,
  color = '#6366f1',
}: MiniSparklineProps) {
  if (!data || data.length < 2) {
    return <span className="text-gray-300 text-xs">—</span>;
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * w;
      const y = pad + h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
