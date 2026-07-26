/**
 * Zorluk düzeyi veri modeli hâlâ 1-5 arası sayı (backward compat, KURAL #3).
 * UI'da üç etikete indirgenir; kullanıcı bir etikete BİLFİİL tıklamadıkça
 * var olan sayısal değer (örn. eski bir soruda 2 veya 4) değişmeden kalır.
 */
export const DIFFICULTY_LABELS: [number, string][] = [[1, 'Kolay'], [3, 'Orta'], [5, 'Zor']];

/** Bir sayısal zorluk değerini en yakın etiketin değerine eşler (sadece GÖRÜNTÜLEME için). */
export function nearestDifficultyValue(d: number): number {
  if (d <= 2) return 1;
  if (d === 3) return 3;
  return 5;
}
