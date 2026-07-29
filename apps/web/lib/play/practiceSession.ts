/** Pratik oturumunu sayfa yenilemesine dayanıklı saklama (madde 4 ve 9).
 *
 *  Neden sessionStorage: oturum bilgisi KALICI olmamalı — sporcu sekmeyi
 *  kapatınca yeni bir set çekilsin. Yenilemede (F5) ise aynı sorularda,
 *  aynı sırada kalınır.
 *
 *  Saklanan veri KULLANICI CEVABI DEĞİL, yalnızca hangi soruların hangi
 *  sırayla gösterildiğidir; puanlama sunucuda kalır.
 */

export interface StoredSession<T> {
  /** Gösterilen soru seti (karıştırılmış hali). */
  items: T[];
  /** Kalınan sorunun sırası. */
  index: number;
}

export function sessionKey(stepId: number | string, mode: string): string {
  return `bsa:pratik:${stepId}:${mode}`;
}

export function loadSession<T>(key: string): StoredSession<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession<T>;
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    const index = Number.isInteger(parsed.index) ? parsed.index : 0;
    // Bozuk/eski kayit ekrani kilitlemesin: sira daima sinir icinde.
    return { items: parsed.items, index: Math.min(Math.max(index, 0), parsed.items.length - 1) };
  } catch {
    return null;
  }
}

export function saveSession<T>(key: string, data: StoredSession<T>): void {
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
