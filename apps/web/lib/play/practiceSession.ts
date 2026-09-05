/** Pratik oturumunu sayfa yenilemesine dayanıklı saklama (madde 4, 6, 7, 9).
 *
 *  Neden sessionStorage: oturum bilgisi KALICI olmamalı — sporcu sekmeyi
 *  kapatınca (veya yeniden giriş yapınca) yeni bir set çekilsin. Yenilemede
 *  (F5) ise aynı sorularda, aynı sırada, aynı cevap durumunda kalınır.
 *
 *  Saklanan veri KULLANICI CEVABININ DOĞRU/YANLIŞ OLDUĞU bilgisidir (madde 6
 *  — sayfa yenilemesiyle aynı soru tekrar çözülemesin diye), asıl PUANLAMA
 *  yine sunucuda kalır.
 */

export interface StoredSession<T> {
  /** Gösterilen soru seti (karıştırılmış hali). */
  items: T[];
  /** Kalınan sorunun sırası. */
  index: number;
  /** index'teki sorunun cevap durumu — 'wrong' ise soru KİLİTLİ ve
   *  geribildirimli kalır, sayfa yenilense bile tekrar çözülemez (madde 6). */
  currentAnswer: 'correct' | 'wrong' | null;
  /** O ana kadar doğru sayılan soru sayısı — sayfa yenilenince ilerlemenin
   *  ikinci kez sayılmaması için. */
  doneCount: number;
  /** Madde 2026-09-05: HER sorunun (items sırasıyla) o ana kadarki
   *  doğru/yanlış durumu — Sporcu Profili "Ödevlerim" paneli için oturum
   *  bitince sunucuya gönderilir. Henüz cevaplanmamış soru null. Opsiyonel:
   *  eski kayıtlarda yok, o zaman undefined döner (çağıran sıfırdan doldurur). */
  perQuestion?: (boolean | null)[];
}

/** saveSession girdisi: yeni alanlar OPSİYONEL — mevcut çağrı noktaları ve
 *  testler `{ items, index }` ile derlenmeye devam eder (KURAL #3).
 *  loadSession ise HER ZAMAN normalize edilmiş tam nesneyi döndürür. */
export type SessionInput<T> =
  Pick<StoredSession<T>, 'items' | 'index'>
  & Partial<Pick<StoredSession<T>, 'currentAnswer' | 'doneCount' | 'perQuestion'>>;

export function sessionKey(stepId: number | string, mode: string): string {
  return `bsa:pratik:${stepId}:${mode}`;
}

export function loadSession<T>(key: string): StoredSession<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession<T>>;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    const index = Number.isInteger(parsed.index) ? (parsed.index as number) : 0;
    // Bozuk/eski kayit ekrani kilitlemesin: sira daima sinir icinde.
    const clampedIndex = Math.min(Math.max(index, 0), parsed.items.length - 1);
    const currentAnswer = parsed.currentAnswer === 'correct' || parsed.currentAnswer === 'wrong'
      ? parsed.currentAnswer : null;
    const doneCount = Number.isInteger(parsed.doneCount) ? (parsed.doneCount as number) : 0;
    const perQuestion = Array.isArray(parsed.perQuestion) && parsed.perQuestion.length === parsed.items.length
      ? parsed.perQuestion : undefined;
    return { items: parsed.items, index: clampedIndex, currentAnswer, doneCount, perQuestion };
  } catch {
    return null;
  }
}

export function saveSession<T>(key: string, data: SessionInput<T>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* kota dolu olabilir — pratik yine calisir, sadece yenilemede set degisir */
  }
}

export function clearSession(key: string): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(key); } catch { /* yok say */ }
}
