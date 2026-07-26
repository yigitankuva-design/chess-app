/** Sporcunun maçta oynayacağı taş rengi (madde f). */
export type PieceColor = 'w' | 'b';
export type ColorChoice = 'white' | 'random' | 'black';

export const COLOR_CHOICES: { value: ColorChoice; label: string; emoji: string }[] = [
  { value: 'white',  label: 'Beyaz',    emoji: '⚪' },
  { value: 'random', label: 'Rastgele', emoji: '🎲' },
  { value: 'black',  label: 'Siyah',    emoji: '⚫' },
];

/** Seçimi somut renge çevirir. 'random' → %50 beyaz / %50 siyah. */
export function resolveColor(choice: ColorChoice): PieceColor {
  if (choice === 'white') return 'w';
  if (choice === 'black') return 'b';
  return Math.random() < 0.5 ? 'w' : 'b';
}

export function oppositeColor(c: PieceColor): PieceColor {
  return c === 'w' ? 'b' : 'w';
}
