/** BotGameLive için maç kimliğinin (yalnızca game_id) sayfa yenilemesine
 *  dayanıklı saklanması. Eski botGameSession.ts'ten (moves/times de saklar)
 *  FARKLI ve çok daha basit — moves/times ARTIK sunucuda, WS'in gönderdiği
 *  game_info mesajıyla geliyor; istemcinin ayrıca saklamasına gerek yok.
 */
export function botGameLiveKey(
  skillLevel: number,
  studentColor: 'w' | 'b',
  startFen?: string,
): string {
  return `bsa:botmac-live:${skillLevel}:${studentColor}:${startFen ?? 'std'}`;
}

export function loadBotGameLiveId(key: string): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function saveBotGameLiveId(key: string, gameId: number): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(key, String(gameId)); } catch { /* yok say */ }
}
