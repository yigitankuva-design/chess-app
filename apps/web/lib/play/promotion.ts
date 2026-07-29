/** Piyon terfisi — saf mantik. */

export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export const PROMOTION_CHOICES: { piece: PromotionPiece; label: string; symbol: string }[] = [
  { piece: 'q', label: 'Vezir', symbol: '♛' },
  { piece: 'r', label: 'Kale',  symbol: '♜' },
  { piece: 'b', label: 'Fil',   symbol: '♝' },
  { piece: 'n', label: 'At',    symbol: '♞' },
];

/** Bu hamle terfi mi? Piyon son yatay siraya varirsa evet. */
export function isPromotionMove(
  piece: { type: string; color: 'w' | 'b' } | null | undefined,
  to: string,
): boolean {
  if (!piece || piece.type !== 'p') return false;
  const rank = to[1];
  return piece.color === 'w' ? rank === '8' : rank === '1';
}

/** Motorun/rakibin UCI'sindeki terfi harfi. Yoksa vezir varsayilmaz —
 *  terfi olmayan hamlede undefined doner, chess.js'e bos gecilir. */
export function promotionFromUci(uci: string): PromotionPiece | undefined {
  const c = uci.slice(4, 5).toLowerCase();
  return c === 'q' || c === 'r' || c === 'b' || c === 'n' ? c : undefined;
}

/** Hamleyi sunucuya/motora gonderilecek UCI'ye cevirir. */
export function toUci(from: string, to: string, promotion?: PromotionPiece): string {
  return `${from}${to}${promotion ?? ''}`;
}
