/**
 * Maç sonucu bildirimi (madde c). Backend'in GameResult enum değerleri
 * ('1-0' | '0-1' | '1/2-1/2') doğrudan bu metinlere eşlenir — yeni bir
 * backend alanı gerekmiyor.
 *
 * NOT: Tireler UZUN TİRE (–, U+2013). Kullanıcının yazdığı biçim aynen korundu.
 */
export const GAME_RESULT_TEXT: Record<string, string> = {
  '1-0': '1 – 0 (Beyaz Kazandı)',
  '0-1': '0 – 1 (Siyah Kazandı)',
  '1/2-1/2': '1/2 – 1/2 (Beraberlik)',
};

/** Bilinmeyen/eksik sonuçta boş string — UI çökmez, sadece bildirim göstermez. */
export function formatGameResult(result: string | undefined): string {
  if (!result) return '';
  return GAME_RESULT_TEXT[result] ?? '';
}
