import type { TimeControl } from '@/components/BotGame';

export interface PlayLevel {
  /** Sporcuya gösterilen düzey numarası (1 en kolay, 8 en zor). */
  level: number;
  /** Stockfish skill level (0-20) — backend de bu aralığı doğruluyor. */
  skill: number;
  /** Stockfish arama derinliği. */
  depth: number;
}

/**
 * 8 zorluk düzeyi (madde e). Eski 5 seviyeli tablo (skill 0/3/8/14/20,
 * depth 1/4/8/10/12) 8 basamağa orantılı olarak genişletildi; uç değerler
 * (skill 0 ve 20, depth 1 ve 12) korundu.
 */
export const LEVELS: PlayLevel[] = [
  { level: 1, skill: 0,  depth: 1 },
  { level: 2, skill: 3,  depth: 3 },
  { level: 3, skill: 6,  depth: 5 },
  { level: 4, skill: 9,  depth: 7 },
  { level: 5, skill: 12, depth: 8 },
  { level: 6, skill: 15, depth: 9 },
  { level: 7, skill: 18, depth: 11 },
  { level: 8, skill: 20, depth: 12 },
];

/**
 * Tempo grupları. "Süresiz" KASTEN YOK (madde g) — her maçın saati olmak
 * zorunda, aksi halde terk/beraberlik dışında maç bitmeyebilir.
 */
export const TIME_GROUPS: { cat: string; emoji: string; items: TimeControl[] }[] = [
  { cat: 'Yıldırım', emoji: '⚡', items: [
    { label: '3+2', base: 180, increment: 2 },
    { label: '5+0', base: 300, increment: 0 },
    { label: '5+3', base: 300, increment: 3 },
  ]},
  { cat: 'Hızlı', emoji: '🚀', items: [
    { label: '10+0',  base: 600, increment: 0 },
    { label: '10+5',  base: 600, increment: 5 },
    { label: '15+10', base: 900, increment: 10 },
  ]},
  { cat: 'Klasik', emoji: '🐢', items: [
    { label: '30+0',  base: 1800, increment: 0 },
    { label: '30+10', base: 1800, increment: 10 },
    { label: '30+20', base: 1800, increment: 20 },
  ]},
];

export const ALL_TIMES: TimeControl[] = TIME_GROUPS.flatMap((g) => g.items);
