/** Bir önceki turda gösterilen soru kodlarını KALICI saklar (madde 4/5/6).
 *
 *  localStorage kullanılır (sessionStorage değil): "sporcu tekrar ettiğinde
 *  farklı sorular gelsin" isteği sekme kapansa/tarayıcı yeniden açılsa da
 *  geçerli olmalı. practiceSession.ts'teki (yenilemede AYNI soruda kalma)
 *  ayrı bir kavramdır — o oturuma özeldir.
 */

function key(stepId: number | string, mode: string): string {
  return `bsa:gecmis:${stepId}:${mode}`;
}

export function loadPreviousCodes(stepId: number | string, mode: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key(stepId, mode));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveShownCodes(stepId: number | string, mode: string, codes: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key(stepId, mode), JSON.stringify(codes));
  } catch {
    /* kota dolu olabilir — sadece tekrar-onleme etkilenir, pratik calisir */
  }
}
