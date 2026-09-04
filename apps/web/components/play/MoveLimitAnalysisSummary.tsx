'use client';
import { computeMoveLimitVerdict } from '@/lib/chess/moveLimitAnalysis';
import type { WhiteScore } from '@/lib/chess/moveQuality';

interface Props {
  evalByPly: Record<number, WhiteScore>;
  progress: { done: number; total: number };
  /** İlerlemenin bittiği ply — evalByPly[totalPly] "sonuç" konumudur. */
  totalPly: number;
  studentColor: 'w' | 'b';
}

/**
 * c) Açılış Konumunu İlerlet — madde 2026-09-06 (üçüncü tur/4): "İlerleme
 * Sınırı" bitince gösterilen özet — sporcu konumunu (ilerleme başı/sonu)
 * karşılaştırarak iyileştirip iyileştirmediğini görür.
 *
 * GEÇİCİ TASARIM: Zafer bu ekran için ayrıca bir görsel gönderecek —
 * o gelince tasarım (gerekirse hesaplama da) buna göre güncellenecek.
 */
export function MoveLimitAnalysisSummary({ evalByPly, progress, totalPly, studentColor }: Props) {
  const verdict = computeMoveLimitVerdict(evalByPly[0], evalByPly[totalPly], studentColor);
  const stillEvaluating = progress.done < progress.total;

  return (
    <div className="t-card-i p-4 text-center space-y-2">
      <p className="font-bold text-sm t-premium">İlerleme Tamamlandı</p>
      {stillEvaluating || !verdict ? (
        <p className="text-xs t-muted">
          Konum değerlendiriliyor... ({progress.done}/{progress.total})
        </p>
      ) : (
        <p className="text-sm font-semibold">
          {verdict.deltaCp > 20 && `Konumun iyileşti! (+${(verdict.deltaCp / 100).toFixed(2)})`}
          {verdict.deltaCp < -20 && `Konumun kötüleşti (${(verdict.deltaCp / 100).toFixed(2)})`}
          {verdict.deltaCp >= -20 && verdict.deltaCp <= 20 && 'Konumun neredeyse aynı kaldı.'}
        </p>
      )}
    </div>
  );
}
