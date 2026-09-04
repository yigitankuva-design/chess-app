import type { ColorChoice } from '@/lib/play/color';

/**
 * c) Açılış Konumunu İlerlet — madde 2026-09-06 (üçüncü tur/4): "Bota Karşı
 * Pratik Yap" akışında Düzey/Tempo seçimi KALKTI (düzey sabit 10. seviyede
 * kalır, Zafer'in onayıyla — bkz. AskUserQuestion kaydı), YERİNE "İlerleme
 * Sınırı Belirle" geldi: sporcu ve bot HER TARAFI AYRI AYRI SAYILARAK bu
 * kadar hamle oynayınca pratik otomatik biter.
 */
export const MOVE_LIMIT_OPTIONS = [5, 10, 15] as const;
export type MoveLimit = typeof MOVE_LIMIT_OPTIONS[number];

/** "Bota Karşı Pratik Yap"ın (c altındaki) 2./3. adımlarının sonucu —
 *  eski MatchCriteriaValue'nun YERİNE geçer (level/timeControl YOK, düzey
 *  sabit 10'da kalır — bkz. OpeningPractice.tsx). */
export interface OpeningAdvanceCriteria {
  colorChoice: ColorChoice;
  moveLimit: MoveLimit;
}
