/** Oturum sonu büyük başlık — saf mantık (madde 7). */
import { UNLOCK_THRESHOLD, unlockedLabel } from './unlock';
import type { PracticeMode } from './unlock';

const MODE_TITLE: Record<PracticeMode, string> = {
  suresiz: 'Süresiz Pratik',
  sureli: 'Süreli Pratik',
  test: 'Kendini Test Et',
};

export interface ResultHeadline { text: string; tone: 'success' | 'retry' }

/** 85 altı: kırmızı "tekrar yap" uyarısı. 85+: yeşil "bir sonrakine geçebilirsin"
 *  müjdesi. Test modunda sonraki adım yok — özel bir tebrik metni kullanılır. */
export function resultHeadline(mode: PracticeMode, score: number): ResultHeadline {
  if (score < UNLOCK_THRESHOLD) {
    return { text: `Üzgünüm Yeniden ${MODE_TITLE[mode]} Yapmalısın`, tone: 'retry' };
  }
  const next = unlockedLabel(mode);
  if (next === 'Sonraki alt konu') {
    return { text: 'Tebrikler! Bu Konuyu Tamamladın', tone: 'success' };
  }
  return { text: `Tebrikler ${next} Yapabilirsin`, tone: 'success' };
}
