'use client';

interface Props {
  /** Canlı konumdaysak şerit GÖSTERİLMEZ. */
  isLive: boolean;
  /** İncelenen yarı-hamle sırası (0 = başlangıç konumu). */
  viewIndex: number;
  onGoLive: () => void;
}

/** Sporcu geçmiş bir konuma baktığında tahtanın altında çıkan şerit
 *  (madde 1). Amaç: sporcunun "taşlarım oynamıyor" diye takılmasını
 *  önlemek — durum AÇIKÇA yazılır ve tek tıkla canlıya dönülür. */
export function HistoryBanner({ isLive, viewIndex, onGoLive }: Props) {
  if (isLive) return null;
  return (
    <div className="t-card-i mt-2 p-2 w-full max-w-[600px] mx-auto flex items-center justify-between gap-2">
      <span className="text-xs t-muted">
        {viewIndex === 0
          ? 'Başlangıç konumu inceleniyor — burada taş oynatamazsın.'
          : `${viewIndex}. hamle inceleniyor — burada taş oynatamazsın.`}
      </span>
      <button type="button" onClick={onGoLive} className="t-btn px-3 py-1 text-xs shrink-0">
        Canlıya dön
      </button>
    </div>
  );
}
