/**
 * c) Açılış Konumunu İlerlet — madde 2026-09-06 (üçüncü tur/4): "İlerleme
 * Sınırı" bitince sporcunun pozisyonunu (İLERLEME BAŞLANGICI vs SONU)
 * karşılaştırıp "iyileşti mi/kötüleşti mi" göstermek için TEMEL bir hesap.
 * GEÇİCİ/İNTERİM: Zafer'in göndereceği görsele göre tasarım (ve belki
 * hesaplama) güncellenecek — bkz. MoveLimitAnalysisSummary.tsx.
 *
 * cp dönüşümü `lib/chess/gameSummary.ts`'teki AYNI teknik, bağımsız kopyası
 * (o modüle bağımlılık kurmamak için — o dosyadaki YERLEŞİK plan kararıyla
 * aynı gerekçe).
 */
import type { WhiteScore } from './moveQuality';

const MATE_BASE_CP = 100_000;
function mateToCp(mate: number): number {
  return Math.sign(mate) * (MATE_BASE_CP - Math.abs(mate) * 100);
}
function effectiveCp(score: WhiteScore): number | null {
  if (score.mate !== null) return mateToCp(score.mate);
  return score.cp;
}
function forSide(cpWhite: number, side: 'w' | 'b'): number {
  return side === 'w' ? cpWhite : -cpWhite;
}

export interface MoveLimitVerdict {
  /** Sporcu açısından, ilerlemenin BAŞINDAKİ skor (santipiyon). */
  startCp: number;
  /** Sporcu açısından, ilerlemenin SONUNDAKİ skor (santipiyon). */
  endCp: number;
  /** Pozitif = pozisyon sporcu lehine iyileşti. */
  deltaCp: number;
}

/** `start`/`end` motor henüz değerlendirmediyse (undefined) null döner. */
export function computeMoveLimitVerdict(
  start: WhiteScore | undefined,
  end: WhiteScore | undefined,
  studentColor: 'w' | 'b',
): MoveLimitVerdict | null {
  if (!start || !end) return null;
  const startWhite = effectiveCp(start);
  const endWhite = effectiveCp(end);
  if (startWhite === null || endWhite === null) return null;
  const startCp = forSide(startWhite, studentColor);
  const endCp = forSide(endWhite, studentColor);
  return { startCp, endCp, deltaCp: endCp - startCp };
}
