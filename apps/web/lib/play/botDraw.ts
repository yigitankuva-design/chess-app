/** Bota beraberlik teklifi — saf mantık (madde 6, güncelleme: 2026-09-03 (2)).
 *
 *  Bot artık HER teklifi kabul etmez: motorun konuma verdiği puana bakar
 *  (sporcunun açısından, piyon cinsinden). Pozisyon eşitliğe YAKINSA
 *  (±3 puan içindeyse) kabul eder; hangi taraf lehine olursa olsun fark
 *  3 puandan büyükse REDDEDER — sporcu ne çok öndeyken ne de çok gerideyken
 *  beraberliği "ucuza" almasın diye.
 */

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** FEN'in taş dizilimi bölümünden malzeme farkını hesaplar (beyaz lehine).
 *  Madde 2026-09-03 (2)'den SONRA `botAcceptsDraw` tarafından kullanılmıyor
 *  (motor değerlendirmesine geçildi) — başka yerde ihtiyaç olursa diye
 *  saf yardımcı fonksiyon olarak KORUNUYOR. */
export function materialDiff(fen: string): number {
  const board = fen.trim().split(/\s+/)[0] ?? '';
  let diff = 0;
  for (const ch of board) {
    const lower = ch.toLowerCase();
    const v = VALUE[lower];
    if (v === undefined) continue;          // rakam veya '/'
    diff += ch === lower ? -v : v;          // kucuk harf siyah, buyuk beyaz
  }
  return diff;
}

/** Sporcunun konumu bu puandan (piyon cinsinden, kendi açısından) fazla
 *  UZAKSA beraberlik reddedilir — hangi yöne uzak olursa olsun. */
export const DRAW_ACCEPT_MARGIN_PAWNS = 3;

/**
 * Bot teklifi kabul eder mi? `studentEvalPawns`: motorun o pozisyona verdiği
 * puan, SPORCUNUN açısından ve piyon cinsinden (100 cp = 1 puan). Kesin bir
 * mat bulunduysa (mate !== null) bu fonksiyona hiç GELİNMEZ — çağıran taraf
 * (BotGame.offerDrawToBot) mat durumunu ayrıca kontrol edip direkt reddeder.
 */
export function botAcceptsDraw(studentEvalPawns: number): boolean {
  return Math.abs(studentEvalPawns) <= DRAW_ACCEPT_MARGIN_PAWNS;
}
