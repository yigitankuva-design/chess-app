/**
 * Zincirleme kilit açma kuralları — saf mantık, ağ/DOM bağımlılığı yok.
 *
 * Zincir bir ALT KONU (lesson_step) içindedir:
 *   Süresiz → (85+) → Süreli → (85+) → Kendini Test Et → (85+) → sonraki alt konu
 *
 * Kilitler pedagojik yönlendirmedir, güvenlik sınırı DEĞİLDİR: URL'yi elle yazan
 * biri kilitli moda girebilir. Skorun kendisi sunucuda hesaplanır.
 */

export const UNLOCK_THRESHOLD = 85;

export type PracticeMode = 'suresiz' | 'sureli' | 'test';

/** stepId → mod → o çocuğun o moddaki EN YÜKSEK skoru (0–100). */
export type ScoreMap = Record<number, Partial<Record<PracticeMode, number>>>;

/** Kayıt yoksa 0 — hiç oynanmamış mod, 85 eşiğini geçemez. */
export function bestScore(scores: ScoreMap, stepId: number, mode: PracticeMode): number {
  return scores[stepId]?.[mode] ?? 0;
}

/**
 * Alt konu açık mı? İlk alt konu her zaman açıktır; sonrakiler bir önceki alt
 * konunun "test" modunda 85+ gerektirir.
 *
 * Listede olmayan stepId AÇIK sayılır: eksik/bozuk veri yüzünden öğrenciyi
 * dışarıda bırakmak, gereğinden fazla erişim vermekten daha kötüdür (KURAL #3).
 */
export function isSubtopicUnlocked(
  orderedStepIds: number[], stepId: number, scores: ScoreMap,
): boolean {
  const idx = orderedStepIds.indexOf(stepId);
  if (idx === -1) return true; // listede yok → kilitleme
  if (idx === 0) return true;  // ilk alt konu
  return bestScore(scores, orderedStepIds[idx - 1], 'test') >= UNLOCK_THRESHOLD;
}

/** Bir alt konunun belirli bir pratik modu açık mı? */
export function isModeUnlocked(
  orderedStepIds: number[], stepId: number, mode: PracticeMode, scores: ScoreMap,
): boolean {
  if (!isSubtopicUnlocked(orderedStepIds, stepId, scores)) return false;
  if (mode === 'suresiz') return true;
  if (mode === 'sureli') return bestScore(scores, stepId, 'suresiz') >= UNLOCK_THRESHOLD;
  return bestScore(scores, stepId, 'sureli') >= UNLOCK_THRESHOLD;
}

/** Bu modda 85+ alınırsa NE açılır — sonuç ekranındaki kutlama satırı için. */
export function unlockedLabel(mode: PracticeMode): string {
  if (mode === 'suresiz') return 'Süreli Pratik';
  if (mode === 'sureli') return 'Kendini Test Et';
  return 'Sonraki alt konu';
}
