import type { CSSProperties } from 'react';

export type ChessThemeId = 'classic' | 'night' | 'neon' | 'sakin' | 'kagit' | 'mercan' | 'erik';

export interface ChessTheme {
  id: ChessThemeId;
  name: string;
  emoji: string;
  description: string;
  lightSquare: string;
  darkSquare: string;
  highlightColor: string;
  selectedColor: string;
  lastMoveColor: string;
  boardShadow?: string;
  boardBg: string;
  accentColor: string;
  accentLight: string;
  textColor: string;
  cardBg: string;
}

export const CHESS_THEMES: ChessTheme[] = [
  {
    id: 'classic',
    name: 'Klasik',
    emoji: '♟️',
    description: 'Chess.com tarzı sıcak renkler',
    lightSquare: '#F0D9B5',
    darkSquare:  '#B58863',
    highlightColor: 'rgba(255, 217, 102, 0.6)',
    selectedColor:  'rgba(72, 187, 120, 0.5)',
    lastMoveColor:  'rgba(246, 246, 105, 0.45)',
    boardBg:    '#1a2e1a',
    accentColor:  '#2e7d32',
    accentLight:  '#4caf50',
    textColor:    '#1a1a1a',
    cardBg:       'rgba(255, 255, 255, 0.97)',
  },
  {
    id: 'night',
    name: 'Gece',
    emoji: '🌙',
    description: 'Lichess tarzı minimalist koyu tema',
    lightSquare: '#DEE3E6',
    darkSquare:  '#8CA2AD',
    highlightColor: 'rgba(117, 153, 0, 0.6)',
    selectedColor:  'rgba(117, 153, 0, 0.5)',
    lastMoveColor:  'rgba(117, 153, 0, 0.35)',
    boardBg:    '#262421',
    accentColor:  '#759900',
    accentLight:  '#9ab800',
    textColor:    '#DEE3E6',
    cardBg:       'rgba(40, 38, 36, 0.97)',
  },
  {
    id: 'neon',
    name: 'Neon',
    emoji: '⚡',
    description: 'Koyu neon tema',
    lightSquare: '#3d4a63',
    darkSquare:  '#222a3a',
    highlightColor: 'rgba(34, 211, 238, 0.55)',
    selectedColor:  'rgba(34, 211, 238, 0.45)',
    lastMoveColor:  'rgba(139, 92, 246, 0.40)',
    boardBg:    '#0e0e17',
    accentColor:  '#22d3ee',
    accentLight:  '#67e8f9',
    textColor:    '#e7e7f0',
    cardBg:       '#0e0e17',
  },
  {
    id: 'sakin',
    name: 'Sakin',
    emoji: '🌿',
    description: 'Sıcak, sakin krem-turuncu tema (uygulama teması)',
    lightSquare: '#F6F2EA',
    darkSquare:  '#CB8F5E',
    highlightColor: 'rgba(217, 123, 63, 0.35)',
    selectedColor:  'rgba(217, 123, 63, 0.5)',
    lastMoveColor:  'rgba(224, 165, 38, 0.4)',
    boardBg:    '#2B2420',
    accentColor:  '#D97B3F',
    accentLight:  '#E8935A',
    textColor:    '#F6F2EA',
    cardBg:       'rgba(43, 36, 32, 0.97)',
  },
  {
    id: 'kagit',
    name: 'Kağıt',
    emoji: '📄',
    description: 'Sade, açık gri-beyaz tema — indigo vurgu',
    lightSquare: '#F2F1EE',
    darkSquare:  '#C8C4E4',
    highlightColor: 'rgba(79, 70, 229, 0.35)',
    selectedColor:  'rgba(79, 70, 229, 0.5)',
    lastMoveColor:  'rgba(79, 70, 229, 0.28)',
    boardBg:    '#1F1F1D',
    accentColor:  '#4F46E5',
    accentLight:  '#6D63F0',
    textColor:    '#1F1F1D',
    cardBg:       'rgba(255, 255, 255, 0.97)',
  },
  {
    id: 'mercan',
    name: 'Mercan',
    emoji: '🪸',
    description: 'Açık krem zemin, canlı mercan-kırmızı vurgu',
    lightSquare: '#FBEEE6',
    darkSquare:  '#D98564',
    highlightColor: 'rgba(226, 96, 63, 0.35)',
    selectedColor:  'rgba(226, 96, 63, 0.5)',
    lastMoveColor:  'rgba(226, 96, 63, 0.3)',
    boardBg:    '#2E2019',
    accentColor:  '#E2603F',
    accentLight:  '#EA8468',
    textColor:    '#2E2019',
    cardBg:       'rgba(255, 255, 255, 0.97)',
  },
  {
    id: 'erik',
    name: 'Erik',
    emoji: '🍷',
    description: 'Koyu bordo-mor tema, fuşya vurgu',
    lightSquare: '#5A4050',
    darkSquare:  '#2E1C26',
    highlightColor: 'rgba(194, 71, 126, 0.5)',
    selectedColor:  'rgba(194, 71, 126, 0.45)',
    lastMoveColor:  'rgba(194, 71, 126, 0.35)',
    boardBg:    '#120A0E',
    accentColor:  '#C2477E',
    accentLight:  '#D97BA0',
    textColor:    '#ECDFE4',
    cardBg:       '#26161D',
  },
];

export const DEFAULT_THEME_ID: ChessThemeId = 'sakin';

export function getTheme(id: ChessThemeId): ChessTheme {
  return CHESS_THEMES.find((t) => t.id === id) ?? CHESS_THEMES[0];
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/**
 * Build per-square backgroundColor styles for all 64 squares.
 * Standard chess: a1 is DARK. Formula: isLight = (fileIndex + rank) % 2 === 0
 *   a1 → (0+1)=1 → 1%2=1 → not 0 → dark ✓
 *   a2 → (0+2)=2 → 2%2=0 → light ✓
 *   h8 → (7+8)=15 → 15%2=1 → dark ✓
 */
export function buildSquareStyles(
  theme: ChessTheme,
  overrides: Record<string, CSSProperties> = {},
  squareColors?: { light: string; dark: string },
): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {};
  const light = squareColors?.light ?? theme.lightSquare;
  const dark = squareColors?.dark ?? theme.darkSquare;
  FILES.forEach((file, fi) => {
    RANKS.forEach((rank) => {
      const isLight = (fi + rank) % 2 === 0;
      const sq = `${file}${rank}`;
      styles[sq] = {
        backgroundColor: isLight ? light : dark,
        transition: 'background-color 0.2s ease',
        ...overrides[sq],
      };
    });
  });
  return styles;
}
