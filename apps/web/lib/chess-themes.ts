import type { CSSProperties } from 'react';

export type ChessThemeId =
  | 'classic'
  | 'night'
  | 'kids'
  | 'purple'
  | 'premium'
  | 'hologram'
  | 'arcade';

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
    darkSquare: '#B58863',
    highlightColor: 'rgba(255, 217, 102, 0.6)',
    selectedColor: 'rgba(72, 187, 120, 0.5)',
    lastMoveColor: 'rgba(246, 246, 105, 0.45)',
    boardBg: '#1a2e1a',
    accentColor: '#2e7d32',
    accentLight: '#4caf50',
    textColor: '#1a1a1a',
    cardBg: 'rgba(255, 255, 255, 0.97)',
  },
  {
    id: 'night',
    name: 'Gece',
    emoji: '🌙',
    description: 'Lichess tarzı minimalist koyu tema',
    lightSquare: '#DEE3E6',
    darkSquare: '#8CA2AD',
    highlightColor: 'rgba(160, 120, 255, 0.6)',
    selectedColor: 'rgba(130, 90, 220, 0.55)',
    lastMoveColor: 'rgba(160, 120, 255, 0.35)',
    boardBg: '#262421',
    accentColor: '#6B4FA0',
    accentLight: '#9C6FD4',
    textColor: '#DEE3E6',
    cardBg: 'rgba(40, 38, 36, 0.97)',
  },
  {
    id: 'kids',
    name: 'Renkli',
    emoji: '🎨',
    description: 'ChessKid tarzı eğlenceli parlak renkler',
    lightSquare: '#FFFDE7',
    darkSquare: '#66BB6A',
    highlightColor: 'rgba(255, 235, 59, 0.7)',
    selectedColor: 'rgba(255, 193, 7, 0.65)',
    lastMoveColor: 'rgba(255, 235, 59, 0.4)',
    boardBg: '#e65100',
    accentColor: '#FF7043',
    accentLight: '#FFAB40',
    textColor: '#1a1a1a',
    cardBg: 'rgba(255, 253, 231, 0.97)',
  },
  {
    id: 'purple',
    name: 'Mor',
    emoji: '🔮',
    description: 'Aimchess tarzı mor gradient',
    lightSquare: '#EDE7F6',
    darkSquare: '#7E57C2',
    highlightColor: 'rgba(209, 196, 233, 0.8)',
    selectedColor: 'rgba(186, 104, 200, 0.65)',
    lastMoveColor: 'rgba(209, 196, 233, 0.5)',
    boardBg: '#1a0533',
    accentColor: '#8E24AA',
    accentLight: '#CE93D8',
    textColor: '#EDE7F6',
    cardBg: 'rgba(26, 5, 51, 0.97)',
  },
  {
    id: 'premium',
    name: 'Premium',
    emoji: '👑',
    description: 'Magnus tarzı lüks koyu tema',
    lightSquare: '#EEEEEE',
    darkSquare: '#37474F',
    highlightColor: 'rgba(255, 215, 0, 0.55)',
    selectedColor: 'rgba(255, 193, 7, 0.5)',
    lastMoveColor: 'rgba(255, 215, 0, 0.3)',
    boardBg: '#0a0a0a',
    accentColor: '#B8860B',
    accentLight: '#FFD700',
    textColor: '#EEEEEE',
    cardBg: 'rgba(15, 15, 15, 0.97)',
  },
  {
    id: 'hologram',
    name: 'Hologram',
    emoji: '💠',
    description: '3D mavi hologram efekti',
    lightSquare: 'rgba(0, 229, 255, 0.18)',
    darkSquare: 'rgba(13, 71, 161, 0.85)',
    highlightColor: 'rgba(0, 229, 255, 0.7)',
    selectedColor: 'rgba(0, 229, 255, 0.85)',
    lastMoveColor: 'rgba(0, 150, 255, 0.5)',
    boardShadow: '0 0 40px rgba(0, 229, 255, 0.45), 0 0 80px rgba(0, 100, 255, 0.2)',
    boardBg: '#000011',
    accentColor: '#00B8D9',
    accentLight: '#00E5FF',
    textColor: '#00E5FF',
    cardBg: 'rgba(0, 10, 40, 0.97)',
  },
  {
    id: 'arcade',
    name: 'Arcade',
    emoji: '🕹️',
    description: 'Oyun tarzı animasyonlu neon tema',
    lightSquare: '#FFF9C4',
    darkSquare: '#D84315',
    highlightColor: 'rgba(255, 235, 59, 0.75)',
    selectedColor: 'rgba(255, 193, 7, 0.8)',
    lastMoveColor: 'rgba(255, 235, 59, 0.45)',
    boardShadow: '0 0 20px rgba(255, 87, 34, 0.5)',
    boardBg: '#121212',
    accentColor: '#FF5722',
    accentLight: '#FF8A65',
    textColor: '#FFF9C4',
    cardBg: 'rgba(18, 18, 18, 0.97)',
  },
];

export const DEFAULT_THEME_ID: ChessThemeId = 'classic';

export function getTheme(id: ChessThemeId): ChessTheme {
  return CHESS_THEMES.find((t) => t.id === id) ?? CHESS_THEMES[0];
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function buildSquareStyles(
  theme: ChessTheme,
  overrides: Record<string, CSSProperties> = {}
): Record<string, CSSProperties> {
  const styles: Record<string, CSSProperties> = {};
  FILES.forEach((file, fi) => {
    RANKS.forEach((rank) => {
      const isLight = (fi + rank) % 2 !== 0;
      const sq = `${file}${rank}`;
      styles[sq] = {
        backgroundColor: isLight ? theme.lightSquare : theme.darkSquare,
        transition: 'background-color 0.25s ease',
        ...overrides[sq],
      };
    });
  });
  return styles;
}
