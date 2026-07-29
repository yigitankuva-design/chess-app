/** Tahta oku geometrisi — saf mantık, React yok.
 *
 *  react-chessboard At hamlesini KODUNDA SABİT olarak "L" şeklinde çizer ve
 *  bunu kapatan bir ayar yoktur. Bu yüzden oklar kendimiz çiziyoruz: her ok,
 *  taşın bulunduğu kareden gideceği kareye EN KISA yoldan DÜZ gider (madde 7).
 *
 *  Koordinatlar 8x8 birim karede: sol üst (0,0), sağ alt (8,8).
 */

export type Orientation = 'white' | 'black';

export interface Point { x: number; y: number }

const FILES = 'abcdefgh';

/** "e4" -> kare merkezi. Geçersiz karede null. */
export function squareCenter(square: string, orientation: Orientation): Point | null {
  if (!square || square.length < 2) return null;
  const file = FILES.indexOf(square[0].toLowerCase());
  const rank = Number(square[1]);
  if (file < 0 || !Number.isFinite(rank) || rank < 1 || rank > 8) return null;
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 8 - rank : rank - 1;
  return { x: col + 0.5, y: row + 0.5 };
}

export interface ArrowLine { x1: number; y1: number; x2: number; y2: number }

/** Başlangıç karesinden çıkışta biraz boşluk bırakır, hedefin merkezine
 *  varmadan durur — ok başı taşın üstünü kapatmasın. */
const START_GAP = 0.28;
const END_GAP = 0.32;

export function arrowLine(
  from: string,
  to: string,
  orientation: Orientation,
): ArrowLine | null {
  const a = squareCenter(from, orientation);
  const b = squareCenter(to, orientation);
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const r = Math.hypot(dx, dy);
  if (r === 0) return null;           // ayni kare: ok yok
  return {
    x1: a.x + (dx * START_GAP) / r,
    y1: a.y + (dy * START_GAP) / r,
    x2: a.x + (dx * (r - END_GAP)) / r,
    y2: a.y + (dy * (r - END_GAP)) / r,
  };
}
