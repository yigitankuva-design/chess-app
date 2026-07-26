/**
 * Beraberlik teklifi hakkı (madde d): her oyuncu bir maçta EN FAZLA 3 kez
 * teklif edebilir. Sayaç sunucuda tutulur (games tablosu), bu modül yalnızca
 * kuralı ifade eder — hem UI hem test aynı kuralı kullanır.
 */
export const MAX_DRAW_OFFERS = 3;

export function canOfferDraw(used: number): boolean {
  return used < MAX_DRAW_OFFERS;
}

export function offersLeft(used: number): number {
  return Math.max(0, MAX_DRAW_OFFERS - used);
}
