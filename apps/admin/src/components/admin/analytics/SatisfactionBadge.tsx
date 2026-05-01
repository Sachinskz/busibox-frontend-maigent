'use client';

interface SatisfactionBadgeProps {
  score: number | null;
  /** Show trend arrow vs previous period */
  trend?: number | null;
  size?: 'sm' | 'md' | 'lg';
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-gray-400';
  if (score >= 60) return 'text-green-600';
  if (score >= 20) return 'text-yellow-600';
  return 'text-red-600';
}

function scoreLabel(score: number | null): string {
  if (score === null) return '—';
  if (score >= 60) return 'Great';
  if (score >= 20) return 'OK';
  return 'Poor';
}

export function SatisfactionBadge({ score, trend, size = 'md' }: SatisfactionBadgeProps) {
  const textSize = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl font-bold' : 'text-base font-semibold';
  const color = scoreColor(score);

  return (
    <span className={`inline-flex items-center gap-1 ${textSize} ${color}`}>
      <span>{score !== null ? `${score > 0 ? '+' : ''}${score}` : '—'}</span>
      {score !== null && (
        <span className="text-xs font-normal text-gray-500">({scoreLabel(score)})</span>
      )}
      {trend !== null && trend !== undefined && (
        <span className={`text-xs ${trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-400'}`}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'}
          {Math.abs(trend)}
        </span>
      )}
    </span>
  );
}
