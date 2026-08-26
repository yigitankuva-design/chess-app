/**
 * Analiz Et sekmesi — madde 2026-09-05 (3): hamle kalitesi işaretleri
 * (?/??/!/!!). Bir hamlenin OYNAYAN taraf açısından pozisyonu ne kadar
 * kötüleştirdiği/iyileştirdiği, hamleden ÖNCEKİ ve SONRAKİ pozisyon
 * değerlendirmesinin (her ikisi de BEYAZ açısından, `scoreForWhite` ile
 * normalize edilmiş) farkına bakılarak hesaplanır. Yalnızca CİDDİ değişim
 * yapan hamleler işaretlenir (Zafer hoca kararı) — küçük dalgalanmalar
 * sessiz kalır.
 */

export interface WhiteScore {
  cp: number | null;
  mate: number | null;
}

export type MoveQuality = { symbol: '?' | '??' | '!' | '!!'; tone: 'bad' | 'good' } | null;

/** Mat skorunu eşik mantığının tek tip çalışması için büyük bir centipawn
 *  değerine çevirir — mat N hamlede ne kadar yakınsa mutlak değeri o kadar
 *  büyük olur (daha kesin/daha "aşırı" bir sonuç). */
const MATE_BASE_CP = 100_000;
function mateToCp(mate: number): number {
  return Math.sign(mate) * (MATE_BASE_CP - Math.abs(mate) * 100);
}

function effectiveCp(score: WhiteScore): number | null {
  if (score.mate !== null) return mateToCp(score.mate);
  return score.cp;
}

const VERY_BAD_THRESHOLD = -300;
const BAD_THRESHOLD = -200;
const GOOD_THRESHOLD = 200;
const VERY_GOOD_THRESHOLD = 300;

/**
 * beforeWhite/afterWhite: hamleden ÖNCEKİ/SONRAKİ pozisyonun BEYAZ açısından
 * skoru. mover: bu hamleyi kimin oynadığı ('w' | 'b').
 */
export function classifyMoveQuality(
  beforeWhite: WhiteScore, afterWhite: WhiteScore, mover: 'w' | 'b',
): MoveQuality {
  const before = effectiveCp(beforeWhite);
  const after = effectiveCp(afterWhite);
  if (before === null || after === null) return null;

  const deltaWhite = after - before;
  const deltaForMover = mover === 'w' ? deltaWhite : -deltaWhite;

  if (deltaForMover <= VERY_BAD_THRESHOLD) return { symbol: '??', tone: 'bad' };
  if (deltaForMover <= BAD_THRESHOLD) return { symbol: '?', tone: 'bad' };
  if (deltaForMover >= VERY_GOOD_THRESHOLD) return { symbol: '!!', tone: 'good' };
  if (deltaForMover >= GOOD_THRESHOLD) return { symbol: '!', tone: 'good' };
  return null;
}
