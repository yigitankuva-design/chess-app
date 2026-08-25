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
      style={{ width: 22, background: '#1a1a1a', border: '2px solid rgba(34,211,238,0.6)' }}
    >
      <div
        className="absolute left-0 right-0 bottom-0 transition-all duration-300"
        style={{ height: `${whiteRatio * 100}%`, background: '#eef0f2' }}
      />
    </div>
  );
}
