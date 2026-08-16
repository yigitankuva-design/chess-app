/**
 * Zincirleme kilit açma kuralları — saf mantık, ağ/DOM bağımlılığı yok.
 *
 * Zincir bir ALT KONU (lesson_step) içindedir:
 *   Süresiz → (85+) → Süreli → (85+) → Kendini Test Et → (85+) → sonraki alt konu
 *
 * Kilitler pedagojik yönlendirmedir, güvenlik sınırı DEĞİLDİR: URL'yi elle yazan
 * biri kilitli moda girebilir. Skorun kendisi sunucuda hesaplanır.
 */

/** Hoca bir alt konu + mod için özel puan girmediyse kullanılan varsayılan eşik. */
export const UNLOCK_THRESHOLD = 85;

export type PracticeMode = 'suresiz' | 'sureli' | 'test';

/**
 * Mod → adım content_json'daki soru/puan alanı. Admin'in question_counts ve
 * success_scores kayıtları bu alan adlarıyla anahtarlanır — tek kaynak,
 * birden fazla yerde aynı string'in elle yazılıp yanlış yazılma riski olmasın.
 */
export const PRACTICE_MODE_FIELDS: Record<PracticeMode, string> = {
  suresiz: 'board_exercises',
  sureli: 'board_exercises_timed',
  test: 'board_exercises_test',
};

/** stepId → mod → o çocuğun o moddaki EN YÜKSEK skoru (0–100). */
export type ScoreMap = Record<number, Partial<Record<PracticeMode, number>>>;

/**
 * stepId → mod → hoca'nın o alt konu + mod için Admin'de belirlediği geçme
 * puanı (0–100). Girilmemişse thresholdFor UNLOCK_THRESHOLD (85) döner.
 */
export type ThresholdMap = Record<number, Partial<Record<PracticeMode, number>>>;

/** Kayıt yoksa 0 — hiç oynanmamış mod, eşiği geçemez. */
export function bestScore(scores: ScoreMap, stepId: number, mode: PracticeMode): number {
  return scores[stepId]?.[mode] ?? 0;
}

/** Bu alt konu + modun geçme eşiği — hoca girmediyse UNLOCK_THRESHOLD (85). */
export function thresholdFor(
  thresholds: ThresholdMap | undefined, stepId: number, mode: PracticeMode,
): number {
  return thresholds?.[stepId]?.[mode] ?? UNLOCK_THRESHOLD;
}

/**
 * Alt konu açık mı? İlk alt konu her zaman açıktır; sonrakiler bir önceki alt
 * konunun "test" modunda kendi eşiğini (girilmediyse 85) geçmeyi gerektirir.
 *
 * Listede olmayan stepId AÇIK sayılır: eksik/bozuk veri yüzünden öğrenciyi
 * dışarıda bırakmak, gereğinden fazla erişim vermekten daha kötüdür (KURAL #3).
 */
export function isSubtopicUnlocked(
  orderedStepIds: number[], stepId: number, scores: ScoreMap, thresholds?: ThresholdMap,
): boolean {
  const idx = orderedStepIds.indexOf(stepId);
  if (idx === -1) return true; // listede yok → kilitleme
  if (idx === 0) return true;  // ilk alt konu
  const prevId = orderedStepIds[idx - 1];
  return bestScore(scores, prevId, 'test') >= thresholdFor(thresholds, prevId, 'test');
}

/** Bir alt konunun belirli bir pratik modu açık mı? */
export function isModeUnlocked(
  orderedStepIds: number[], stepId: number, mode: PracticeMode, scores: ScoreMap, thresholds?: ThresholdMap,
): boolean {
  if (!isSubtopicUnlocked(orderedStepIds, stepId, scores, thresholds)) return false;
  if (mode === 'suresiz') return true;
  if (mode === 'sureli') return bestScore(scores, stepId, 'suresiz') >= thresholdFor(thresholds, stepId, 'suresiz');
  return bestScore(scores, stepId, 'sureli') >= thresholdFor(thresholds, stepId, 'sureli');
}

/** Bu modda 85+ alınırsa NE açılır — sonuç ekranındaki kutlama satırı için. */
export function unlockedLabel(mode: PracticeMode): string {
  if (mode === 'suresiz') return 'Süreli Pratik';
  if (mode === 'sureli') return 'Kendini Test Et';
  return 'Sonraki alt konu';
}

/**
 * Bir DERS tamamlandı mı? Kural: dersin SON alt konusunda "Kendini Test Et"
 * kendi eşiğini (girilmediyse 85) geçmişse ders bitmiştir — alt konu zinciri
 * zaten öncekileri zorunlu kılar.
 *
 * scores henüz alınmadıysa (undefined) false döner; çağıran bu durumda KİLİT
 * UYGULAMAZ (yükleniyor diye öğrenciyi dışarıda bırakmayız).
 *
 * Alt konusu olmayan ders TAMAMLANMIŞ sayılır: içeriği olmayan bir ders
 * sonraki dersleri kilitlemesin (KURAL #3).
 */
export function isLessonCompleted(
  orderedStepIds: number[], scores: ScoreMap | undefined, thresholds?: ThresholdMap,
): boolean {
  if (!scores) return false;
  if (orderedStepIds.length === 0) return true;
  const last = orderedStepIds[orderedStepIds.length - 1];
  return bestScore(scores, last, 'test') >= thresholdFor(thresholds, last, 'test');
}

/**
 * Ders açık mı? İlk ders her zaman açıktır; sonrakiler bir ÖNCEKİ dersin
 * tamamlanmasını gerektirir (madde 10 — "1. dersi bitirmeden diğerine giriş
 * olmasın").
 *
 * completedById'de önceki dersin bilgisi YOKSA (veri henüz gelmedi) ders
 * AÇIK sayılır — eksik veri yüzünden erişim kesilmez.
 */
export function isLessonUnlocked(
  orderedLessonIds: number[],
  lessonId: number,
  completedById: Record<number, boolean | undefined>,
): boolean {
  const idx = orderedLessonIds.indexOf(lessonId);
  if (idx <= 0) return true;
  const prev = orderedLessonIds[idx - 1];
  const known = completedById[prev];
  if (known === undefined) return true;
  return known;
}
