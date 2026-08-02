/** Ön-hamle (premove) — saf mantık (madde 5).
 *
 *  Sporcu rakibi beklerken hamlesini önceden seçer. Sıra kendisine geldiğinde
 *  bu hamle GEÇERLİYSE oynanır; değilse SESSİZCE iptal edilir (kullanıcı
 *  kararı — uyarı gösterilmez, akış bozulmaz).
 *
 *  Bu modül tahtayı DEĞİŞTİRMEZ; yalnız "oynanabilir mi" sorusunu yanıtlar.
 *  Hamleyi uygulamak çağıran bileşenin işidir (ses, saat, sunucuya yazma
 *  oradaki normal akışla çalışsın diye).
 */
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

export interface Premove {
  from: Square;
  to: Square;
}

/** Geçerliyse ön-hamlenin kendisini, değilse null döndürür. */
export function resolvePremove(fen: string, pm: Premove | null): Premove | null {
  if (!pm) return null;
  try {
    // Terfi her zaman vezir — BotGame/LiveGame/movePlayer ile tutarlı.
    const board = new Chess(fen, { skipValidation: true });
    const move = board.move({ from: pm.from, to: pm.to, promotion: 'q' });
    return move ? pm : null;
  } catch {
    return null;
  }
}
