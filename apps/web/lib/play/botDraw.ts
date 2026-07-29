/** Bota beraberlik teklifi — saf mantık (madde 6).
 *
 *  Bot pazarlık yapmaz: sadece konuma bakar. Malzeme farkı bir piyondan
 *  büyükse ve bot ÖNDEYSE teklifi reddeder; başka her durumda kabul eder.
 *  (Geride olan bot beraberliği zaten ister.)
 */

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** FEN'in taş dizilimi bölümünden malzeme farkını hesaplar (beyaz lehine). */
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

/** Bot teklifi kabul eder mi? botColor botun rengi. */
export function botAcceptsDraw(fen: string, botColor: 'w' | 'b'): boolean {
  const white = materialDiff(fen);
  const botLead = botColor === 'w' ? white : -white;
  // Bir piyondan fazla ONDEYSE reddeder.
  return botLead <= 1;
}
