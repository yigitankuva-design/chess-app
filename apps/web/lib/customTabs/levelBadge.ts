import type { ReactNode } from 'react';
import { createElement } from 'react';

/**
 * Madde 2026-09-05 (2): alt sekmelerin hangi güç seviyesine uygun olduğunu
 * belirtmek için ikon havuzunun yanına eklenen 2 harfli kod sistemi.
 * `emoji` alanı serbest string olduğu için (şema değişikliği YOK) bu kodlar
 * doğrudan aynı alana yazılır — render katmanı kod mu emoji mi ayırt eder.
 */
export const LEVEL_CODES = ['TS', 'TD', 'BD', 'OD', 'İD'] as const;
export type LevelCode = (typeof LEVEL_CODES)[number];

export const LEVEL_CODE_LABELS: Record<LevelCode, string> = {
  TS: 'Tüm Seviyeler İçin Uygun',
  TD: 'Temel Düzeye Uygun',
  BD: 'Başlangıç Düzeyine Uygun',
  OD: 'Orta Düzeye Uygun',
  İD: 'İleri Düzeye Uygun',
};

export const LEVEL_CODE_COLORS: Record<LevelCode, string> = {
  TS: '#9ca3af', // nötr gri — tüm seviyeler
  TD: '#34d399', // yeşil — temel
  BD: '#38bdf8', // mavi — başlangıç
  OD: '#f59e0b', // amber — orta
  İD: '#f472b6', // kırmızı-mor — ileri
};

export function isLevelCode(value: string | null | undefined): value is LevelCode {
  return !!value && (LEVEL_CODES as readonly string[]).includes(value);
}

/**
 * Bir alt sekmenin `emoji` alanını render eder — değer bir seviye koduysa
 * (TS/TD/BD/OD/İD) renkli/kalın bir rozet döner, değilse emoji metnini
 * (veya fallback'i) aynen döner. `s.emoji || fallback` çağrılarının yerini alır.
 */
export function renderSectionIcon(
  emoji: string | null | undefined, fallback: string = '🎯',
): ReactNode {
  if (isLevelCode(emoji)) {
    return createElement('span', {
      'aria-label': LEVEL_CODE_LABELS[emoji],
      style: {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '100%', height: '100%', fontWeight: 800, fontSize: '0.7em',
        color: LEVEL_CODE_COLORS[emoji], letterSpacing: '-0.02em',
      },
    }, emoji);
  }
  return emoji || fallback;
}
