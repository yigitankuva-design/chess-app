/** Bot maçının sayfa yenilemesine dayanıklı saklanması (madde 3).
 *
 *  Neden sessionStorage: `lib/play/practiceSession.ts` ile AYNI gerekçe —
 *  sekmeye özeldir, sekme kapanınca temizlenir, F5'te korunur. Sporcu
 *  yenileme yaptığında bot maçı SIFIRDAN başlamaz.
 *
 *  Neden UCI listesi saklanır (FEN değil): tahta hamleler tekrar oynatılarak
 *  kurulunca chess.js'in hamle geçmişi de geri gelir — notasyon kartı ve
 *  hamle gezinmesi (madde 1) çalışmaya devam eder. Sadece FEN saklansaydı
 *  geçmiş kaybolurdu.
 */

export interface StoredBotGame {
  /** Backend'deki oyun kimliği; çevrimdışı başlandıysa null olabilir. */
  gameId: number | null;
  /** Oynanmış hamleler, UCI ('e2e4'). Tahta bunlardan yeniden kurulur. */
  moves: string[];
  whiteTime: number;
  blackTime: number;
  drawOffersUsed: number;
}

export function botGameKey(
  skillLevel: number,
  studentColor: 'w' | 'b',
  startFen?: string,
): string {
  // startFen açılış pratiğinde farklıdır; anahtara girmezse sporcu farklı
  // açılışa geçtiğinde eski maçla karşılaşır.
  return `bsa:botmac:${skillLevel}:${studentColor}:${startFen ?? 'std'}`;
}

function toCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function loadBotGame(key: string): StoredBotGame | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredBotGame>;
    // Hamlesi olmayan kayıt işe yaramaz — yeni oyun açılsın.
    if (!Array.isArray(parsed.moves) || parsed.moves.length === 0) return null;
    if (parsed.moves.some((m) => typeof m !== 'string')) return null;
    return {
      gameId: typeof parsed.gameId === 'number' ? parsed.gameId : null,
      moves: parsed.moves,
      whiteTime: toCount(parsed.whiteTime),
      blackTime: toCount(parsed.blackTime),
      drawOffersUsed: toCount(parsed.drawOffersUsed),
    };
  } catch {
    return null;
  }
}

export function saveBotGame(key: string, data: StoredBotGame): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* kota dolu olabilir — maç yine oynanır, sadece yenilemede sıfırlanır */
  }
}

export function clearBotGame(key: string): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(key); } catch { /* yok say */ }
}
