interface Props {
  currentXP: number;
  rankName: string;
  nextRankXP: number;
}

export function XPBar({ currentXP, rankName, nextRankXP }: Props) {
  const denom = nextRankXP > 0 ? nextRankXP : Math.max(currentXP, 1);
  const progress = Math.min(100, (currentXP / denom) * 100);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-bold">{rankName}</span>
        <span className="opacity-75">
          {currentXP} / {nextRankXP} XP
        </span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-400 to-purple-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
