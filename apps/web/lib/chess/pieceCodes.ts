import type { CHESS_PIECE_SET } from '@/lib/chess/boardSkin';

/** Paletteki 12 taş — FEN harfi (büyük=beyaz, küçük=siyah) ve Türkçe adı. */
export const PIECE_PALETTE: { code: string; label: string }[] = [
  { code: 'K', label: 'Beyaz Şah' }, { code: 'Q', label: 'Beyaz Vezir' }, { code: 'R', label: 'Beyaz Kale' },
  { code: 'B', label: 'Beyaz Fil' }, { code: 'N', label: 'Beyaz At' }, { code: 'P', label: 'Beyaz Piyon' },
  { code: 'k', label: 'Siyah Şah' }, { code: 'q', label: 'Siyah Vezir' }, { code: 'r', label: 'Siyah Kale' },
  { code: 'b', label: 'Siyah Fil' }, { code: 'n', label: 'Siyah At' }, { code: 'p', label: 'Siyah Piyon' },
];

/** Palet kodunu (K, p, ...) taş seti anahtarına (wK, bP, ...) çevirir. */
export function pieceKey(code: string): keyof typeof CHESS_PIECE_SET {
  return `${code === code.toUpperCase() ? 'w' : 'b'}${code.toUpperCase()}` as keyof typeof CHESS_PIECE_SET;
}

/** Taş seti anahtarını (wP, bN, ...) FEN karakterine (P, n, ...) çevirir. */
export function pieceTypeToFen(pieceType: string): string {
  const color = pieceType[0];
  const type = pieceType[1];
  return color === 'w' ? type.toUpperCase() : type.toLowerCase();
}

/**
 * Geçerli bir FEN taş harfi mi?
 * SIRA ÖNEMLİ: uzunluk önce kontrol edilir — `''.includes` mantığıyla boş dize
 * her zaman "içeriliyor" sayılırdı.
 */
export function isPieceCode(code: string): boolean {
  return code.length === 1 && 'KQRBNPkqrbnp'.includes(code);
}

/** Taşın Türkçe adı (bulunamazsa kodun kendisi). */
export function pieceLabel(code: string): string {
  return PIECE_PALETTE.find((p) => p.code === code)?.label ?? code;
}
