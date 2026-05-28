interface Props {
  currentXP: number;
  rankName: string;
  nextRankXP: number;
}

export function XPBar({ currentXP, rankName, nextRankXP }: Props) {
  const denom = nextRankXP > 0 ? nextRankXP : Math.max(currentXP, 1);
  const progress = Math.min(100, (currentXP / denom) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-semibold">{rankName}</span>
        <span className="t-muted text-xs">
          {currentXP} / {nextRankXP} XP
        </span>
      </div>
      <div className="t-prog-track">
        <div
          className="t-prog-fill transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
