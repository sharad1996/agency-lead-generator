import { Badge } from '@/components/ui/badge';

interface ScoreBadgeProps {
  score: number | null;
  priority: 'HOT' | 'WARM' | 'COLD' | null;
}

const priorityConfig = {
  HOT: { className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100' },
  WARM: { className: 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-100' },
  COLD: { className: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100' },
};

export function ScoreBadge({ score, priority }: ScoreBadgeProps) {
  if (!priority || score === null) {
    return (
      <Badge variant="outline" className="text-gray-400">
        Pending
      </Badge>
    );
  }

  const config = priorityConfig[priority];

  return (
    <div className="flex items-center gap-1.5">
      <Badge className={config.className}>{priority}</Badge>
      <span className="text-sm font-mono text-gray-600">{score}</span>
    </div>
  );
}
