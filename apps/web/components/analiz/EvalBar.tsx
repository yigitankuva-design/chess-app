interface Props {
  /** Beyaz açısından skor (lib/chess/analysisFormat.ts::scoreForWhite ile çevrilmiş olmalı). */
  scoreCp: number | null;
  mate: number | null;
}

/** cp'yi [0,1] aralığında beyaz kazanma oranına çevirir — standart sigmoid eğrisi
 *  (lichess/chess.com eval bar'larıyla AYNI mantık): 0 = siyah tam üstün,
 *  1 = beyaz tam üstün, 0.5 = eşit. */
function whiteFraction(scoreCp: number | null, mate: number | null): number {
  if (mate !== null) return mate > 0 ? 0.97 : 0.03;
  if (scoreCp === null) return 0.5;
  const clamped = Math.max(-1000, Math.min(1000, scoreCp));
  return 1 / (1 + Math.pow(10, -clamped / 400));
}

function scoreLabel(scoreCp: number | null, mate: number | null): string {
  if (mate !== null) return `M${Math.abs(mate)}`;
  if (scoreCp === null) return '–';
  const val = (scoreCp / 100).toFixed(1);
  return scoreCp > 0 ? `+${val}` : val;
}

/**
 * Analiz Et sekmesi — dikey eval çubuğu (görsel referans: lichess/chess.com
 * analiz paneli). Tahtayla AYNI satırda, `align-items: stretch` ile
 * yüksekliği otomatik olarak tahtanınkine eşitlenir (bkz. AnalysisBoard.tsx).
 */
export function EvalBar({ scoreCp, mate }: Props) {
  const whiteRatio = whiteFraction(scoreCp, mate);
  return (
    <div
      role="meter"
      aria-label="Değerlendirme çubuğu"
      aria-valuenow={Math.round(whiteRatio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative flex-shrink-0 rounded-md overflow-hidden"
      style={{ width: 22, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)' }}
    >
      <div
        className="absolute left-0 right-0 bottom-0 transition-all duration-300"
        style={{ height: `${whiteRatio * 100}%`, background: '#eef0f2' }}
      />
      <div
        className="absolute left-0 right-0 text-center font-mono"
        style={{
          fontSize: 9, fontWeight: 700, padding: '2px 0',
          top: whiteRatio >= 0.5 ? undefined : 2,
          bottom: whiteRatio >= 0.5 ? 2 : undefined,
          color: whiteRatio >= 0.5 ? '#111' : '#eee',
        }}
      >
        {scoreLabel(scoreCp, mate)}
      </div>
    </div>
  );
}
