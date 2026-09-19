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

/** Madde 2026-09-19 (Özel İkon Yükleme): admin artık emoji havuzu yerine
 *  kendi resmini de yükleyebiliyor — `emoji` alanı serbest string olduğu
 *  için (şema değişikliği YOK) resim bir data URL olarak AYNI alana yazılır,
 *  render katmanı `data:image/` öneki ile ayırt eder. */
export function isImageIcon(value: string | null | undefined): boolean {
  return !!value && value.startsWith('data:image/');
}

/**
 * Bir alt sekmenin `emoji` alanını render eder — değer bir seviye koduysa
 * (TS/TD/BD/OD/İD) renkli/kalın bir rozet, bir resimse (data URL) <img>,
 * değilse emoji metnini (veya fallback'i) aynen döner. `s.emoji || fallback`
 * çağrılarının yerini alır. İçine konduğu kapsayıcı sabit boyutlu olmalı
 * (resim %100 genişlik/yükseklik kaplar).
 */
export function renderSectionIcon(
  emoji: string | null | undefined, fallback: string = '🎯',
): ReactNode {
  if (isImageIcon(emoji)) {
    return createElement('img', {
      src: emoji, alt: '',
      style: { width: '100%', height: '100%', objectFit: 'contain', borderRadius: '22%', display: 'block' },
    });
  }
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

/**
 * Madde 2026-09-19: Antrenör/sporcu panelindeki büyük sekme kartları
 * (FeatureTab) için — `renderSectionIcon`'dan farkı, kapsayıcı span'ın
 * sabit boyutu OLMADIĞI (font-size ile büyüyen bir <span> içine konduğu)
 * için resim durumunda AÇIK piksel genişlik/yükseklik verilir, `fallback`
 * da bir ReactNode'dur (emoji havuzu YOKSA eski sabit SVG ikon gösterilsin
 * diye — `L.icons.play || <IconSwords s={45} />` çağrılarının yerini alır).
 */
export function renderTabIcon(
  value: string | null | undefined, fallback: ReactNode, size = 45,
): ReactNode {
  if (isImageIcon(value)) {
    return createElement('img', {
      src: value, alt: '', width: size, height: size,
      style: { objectFit: 'contain', borderRadius: size * 0.22, display: 'block' },
    });
  }
  return value || fallback;
}
