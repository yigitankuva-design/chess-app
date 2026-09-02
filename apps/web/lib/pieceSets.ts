/**
 * Madde 2026-09-02: Profil sayfasındaki "Taş Görünümünü Değiştir" kartı için
 * — açık lisanslı 4 taş seti (bkz. public/pieces/LICENSES.md). Her set,
 * public/pieces/<id>/<PIECE_KEY>.svg altında statik dosya olarak duruyor;
 * burada sadece kimlik/isim/yol eşlemesi var. Gerçek <img> render'ı ZATEN
 * VAR OLAN lib/chess/boardSkin.tsx::getPieceSet() üzerinden yapılır — bu
 * dosya ona bir URI map üretmekten başka bir şey yapmaz.
 */

export type PieceSetId = 'cburnett' | 'merida' | 'chessnut' | 'kiwen-suwi';

export const PIECE_SET_ORDER: PieceSetId[] = ['cburnett', 'merida', 'chessnut', 'kiwen-suwi'];

export const PIECE_SET_NAMES: Record<PieceSetId, string> = {
  cburnett: 'Mevcut (Cburnett)',
  merida: 'Merida',
  chessnut: 'Chessnut',
  'kiwen-suwi': 'Kiwen-Suwi',
};

const PIECE_KEYS = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP'] as const;

/** id -> {wK: '/pieces/id/wK.svg', ...} — getPieceSet()'e verilecek URI map. */
export function pieceSetUris(id: PieceSetId): Record<string, string> {
  const map: Record<string, string> = {};
  for (const k of PIECE_KEYS) map[k] = `/pieces/${id}/${k}.svg`;
  return map;
}
