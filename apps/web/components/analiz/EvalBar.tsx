interface Props {
  /** Beyaz açısından skor (lib/chess/analysisFormat.ts::scoreForWhite ile çevrilmiş olmalı). */
  scoreCp: number | null;
  mate: number | null;
  /** Madde 2026-09-18 (Antrenör Canlı Ders): SADECE antrenörün canlı ders
   *  anlatım ekranında açılır — dolgu sınırıyla AYNI konumda hareket eden
   *  mavi bir işaretleyici + o anki değerlendirme puanı gösterilir.
   *  Verilmezse (varsayılan `false`) madde 2026-09-03 (6)'daki "çubukta
   *  sayısal metin YOK" davranışı AYNEN korunur — "Analiz Et" ekranları
   *  (`AnalysisBoard.tsx`) bu prop'u HİÇ vermez, ETKİLENMEZ. */
  showMarker?: boolean;
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

/** Madde 2026-09-18: işaretleyicinin yanında gösterilen değer — Türkçe
 *  virgüllü, tek ondalık (görseldeki "+1,7"/"-3,2" ile birebir). Mat
 *  durumunda CandidateLines.tsx'teki AYNI "#N" kuralı. */
function markerLabel(scoreCp: number | null, mate: number | null): string {
  if (mate !== null) return `${mate > 0 ? '' : '-'}#${Math.abs(mate)}`;
  const cp = scoreCp ?? 0;
  const val = (Math.abs(cp) / 100).toFixed(1).replace('.', ',');
  if (cp === 0) return `0,0`;
  return cp > 0 ? `+${val}` : `-${val}`;
}

/**
 * Analiz Et sekmesi — dikey eval çubuğu (görsel referans: lichess/chess.com
 * analiz paneli). Tahtayla AYNI satırda, `align-items: stretch` ile
 * yüksekliği otomatik olarak tahtanınkine eşitlenir (bkz. AnalysisBoard.tsx).
 */
export function EvalBar({ scoreCp, mate, showMarker = false }: Props) {
  const whiteRatio = whiteFraction(scoreCp, mate);
  const markerTop = `${(1 - whiteRatio) * 100}%`;
  return (
    <div style={{ width: 22, position: 'relative', alignSelf: 'stretch' }}>
      <div
        role="meter"
        aria-label="Değerlendirme çubuğu"
        aria-valuenow={Math.round(whiteRatio * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative rounded-md overflow-hidden h-full"
        style={{ background: '#1a1a1a', border: '2px solid rgba(34,211,238,0.6)' }}
      >
        <div
          className="absolute left-0 right-0 bottom-0 transition-all duration-300"
          style={{ height: `${whiteRatio * 100}%`, background: '#eef0f2' }}
        />
      </div>
      {showMarker && (
        <>
          <div
            aria-hidden="true"
            className="absolute transition-all duration-300"
            style={{ top: markerTop, right: -6, transform: 'translateY(-50%)' }}
          >
            <div style={{
              width: 10, height: 10, background: '#3b82f6',
              transform: 'rotate(45deg)', border: '1px solid #1a1a1a',
            }} />
          </div>
          <span
            className="absolute text-xs font-bold font-mono whitespace-nowrap transition-all duration-300"
            style={{ top: markerTop, left: '100%', marginLeft: 10, transform: 'translateY(-50%)', color: '#3b82f6' }}
          >
            {markerLabel(scoreCp, mate)}
          </span>
        </>
      )}
    </div>
  );
}
