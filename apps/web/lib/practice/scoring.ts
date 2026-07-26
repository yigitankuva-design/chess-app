/**
 * Pratik oturumu puanlaması — saf mantık, DOM/ağ bağımlılığı yok.
 *
 * Doğru cevap 5 puan, yanlış 0 puan (d8). Süresiz modda oturum 20 soru olduğu için
 * ham puan (doğru×5) ile yüzde çakışır. Süreli/Test modlarında havuzun tamamı
 * kullanıldığından soru sayısı değişir — bu yüzden eşik kontrolü HER ZAMAN yüzde
 * üzerinden yapılır, ham puan üzerinden değil.
 */

/** 0–100 arası tam sayı puan. total geçersizse 0 döner (sıfıra bölme koruması). */
export function scorePercent(correct: number, total: number): number {
  if (total <= 0) return 0;
  const pct = (correct / total) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)));
}

/**
 * Öğrenciye gösterilecek eşik mesajı.
 * NOT: 85 puanlık KİLİT AÇMA eşiği bundan bağımsızdır (bkz. unlock.ts) — bu
 * fonksiyon yalnızca motive edici metni üretir, kilit kararı vermez.
 */
export function thresholdMessage(score: number): string {
  if (score < 50) return 'Çok Daha Fazla Pratik Yapmalısın';
  if (score <= 80) return 'İyi Gidiyorsun';
  return 'Tebrikler';
}
