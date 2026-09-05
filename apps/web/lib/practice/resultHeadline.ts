/** Oturum sonu büyük başlık — saf mantık (madde 7). */
import { UNLOCK_THRESHOLD, unlockedLabel } from './unlock';
import type { PracticeMode } from './unlock';

// Madde 2026-09-05: "Süresiz Pratik" → "Ödevini" — "Ödevini Yap" adına uygun
// retry mesajı üretsin diye ("Üzgünüm Yeniden Ödevini Yapmalısın").
const MODE_TITLE: Record<PracticeMode, string> = {
  suresiz: 'Ödevini',
  sureli: 'Süreli Pratik',
  test: 'Kendini Test Et',
};

export interface ResultHeadline { text: string; tone: 'success' | 'retry' }

/**
 * threshold altı: kırmızı "tekrar yap" uyarısı. threshold+: yeşil
 * "bir sonrakine geçebilirsin" müjdesi. Test modunda sonraki adım yok — özel
 * bir tebrik metni kullanılır. threshold verilmezse UNLOCK_THRESHOLD (85).
 */
export function resultHeadline(
  mode: PracticeMode, score: number, threshold: number = UNLOCK_THRESHOLD,
): ResultHeadline {
  if (score < threshold) {
    return { text: `Üzgünüm Yeniden ${MODE_TITLE[mode]} Yapmalısın`, tone: 'retry' };
  }
  const next = unlockedLabel(mode);
  if (next === 'Sonraki alt konu') {
    return { text: 'Tebrikler! Bu Konuyu Tamamladın', tone: 'success' };
  }
  return { text: `Tebrikler ${next} Yapabilirsin`, tone: 'success' };
}
