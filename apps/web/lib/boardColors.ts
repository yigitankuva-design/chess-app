/**
 * Madde 2026-09-02: Profil sayfasındaki "Tahta Renklerini Değiştir" kartı
 * için — renkler Lichess'in profil/tercih bölümündeki gerçek tahta
 * temalarından piksel örneklemesiyle alındı (tahmini değil). Bu seçim,
 * sporcunun tema seçiminden (classic/night/neon/sakin) BAĞIMSIZ, ayrı bir
 * kişisel tercihtir.
 */

export type BoardColorId = 'blue' | 'brown' | 'green' | 'purple' | 'ic';

export const BOARD_COLOR_ORDER: BoardColorId[] = ['blue', 'brown', 'green', 'purple', 'ic'];

export interface BoardColorOption {
  id: BoardColorId;
  name: string;
  light: string;
  dark: string;
}

export const BOARD_COLORS: Record<BoardColorId, BoardColorOption> = {
  blue:   { id: 'blue',   name: 'Mavi',   light: '#DEE3E6', dark: '#8CA2AD' },
  brown:  { id: 'brown',  name: 'Kahve',  light: '#F0D9B5', dark: '#B58863' },
  green:  { id: 'green',  name: 'Yeşil',  light: '#FFFFDD', dark: '#86A666' },
  purple: { id: 'purple', name: 'Mor',    light: '#9F90B0', dark: '#7D4A8D' },
  ic:     { id: 'ic',     name: 'IC',     light: '#ECECEC', dark: '#C1C18E' },
};
