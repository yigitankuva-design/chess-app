import type { TimeControl } from '@/components/BotGame';

export interface PlayLevel {
  /** Sporcuya gösterilen düzey numarası (1 en kolay, 10 en zor). */
  level: number;
  /** Stockfish skill level (0-20) — backend de bu aralığı doğruluyor. */
  skill: number;
  /** Stockfish arama derinliği. */
  depth: number;
  /**
   * 0-1 arası: botun kasıtlı zayıf hamle yapma ihtimali (bkz. lib/play/blunder.ts).
   * 0 = hiç blunder yapmaz (Stockfish'in kendi gücüyle oynar).
   * Stockfish'in en düşük ayarı bile (skill 0) ~1320 Elo olduğu için, 1300 Elo
   * ALTINDAKİ seviyeler (1-5) bu mekanizma OLMADAN yapılamaz.
   */
  blunderChance: number;
}

/**
 * 10 zorluk düzeyi, ~400 Elo'dan 2200+ Elo'ya kadar (Zafer hoca kararı, 2026-08-09).
 * 1-5. seviyeler kasıtlı hata mekanizmasıyla, 6-10. seviyeler motorun kendi
 * skill/depth ayarıyla çalışır. 6-10. seviyelerin Elo karşılığı TAHMİNİDİR —
 * Stockfish skill 0 dışındaki seviyelerin Elo karşılığı resmi olarak belgeli
 * değildir (bkz. tasarım dosyası: docs/superpowers/specs/2026-08-09-bot-zorluk-10-seviye-design.md).
 */
export const LEVELS: PlayLevel[] = [
  { level: 1,  skill: 20, depth: 6,  blunderChance: 0.60 }, // ~400-600
  { level: 2,  skill: 20, depth: 6,  blunderChance: 0.45 }, // ~600-800
  { level: 3,  skill: 20, depth: 6,  blunderChance: 0.30 }, // ~800-1000
  { level: 4,  skill: 20, depth: 6,  blunderChance: 0.15 }, // ~1000-1200
  { level: 5,  skill: 20, depth: 6,  blunderChance: 0.05 }, // ~1200-1400
  { level: 6,  skill: 10, depth: 8,  blunderChance: 0 },    // ~1400-1600 (tahmini)
  { level: 7,  skill: 13, depth: 9,  blunderChance: 0 },    // ~1600-1800 (tahmini)
  { level: 8,  skill: 16, depth: 10, blunderChance: 0 },    // ~1800-2000 (tahmini)
  { level: 9,  skill: 18, depth: 11, blunderChance: 0 },    // ~2000-2200 (tahmini)
  { level: 10, skill: 20, depth: 12, blunderChance: 0 },    // 2200+ (tahmini)
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

/** Bir süre etiketinin (örn. "5+3") ait olduğu tempo kategorisini bulur
 *  (Yıldırım/Hızlı/Klasik). Eşleşme yoksa BOŞ dizge — uydurulmaz. */
export function tempoCategoryOfLabel(tcLabel: string): string {
  return TIME_GROUPS.find((g) => g.items.some((i) => i.label === tcLabel))?.cat ?? '';
}

/**
 * Pratik Yap akışları için 10 düzey yerine 3 gruplu basitleştirilmiş seçim
 * (Zafer hoca kararı, 2026-08-18; eşleme 2026-08-19'da güncellendi):
 * Kolay→eski Düzey 1, Orta→eski Düzey 5, Zor→eski Düzey 10. Yalnızca
 * Pratik Yap ekranlarında kullanılır (bkz. MatchCriteria'nın
 * simplifiedLevels prop'u) — "Bota Karşı Oyna" gerçek maçı hâlâ 10
 * düzeyin tamamını gösterir.
 */
export const LEVEL_GROUPS: { label: string; level: PlayLevel }[] = [
  { label: 'Kolay', level: LEVELS[0] },
  { label: 'Orta', level: LEVELS[4] },
  { label: 'Zor', level: LEVELS[9] },
];
