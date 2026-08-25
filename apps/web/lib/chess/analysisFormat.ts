import { Chess } from 'chess.js';

/** İngilizce SAN taş harfi → Türkçe karşılığı (Şah/Vezir/Kale/Fil/At). Piyon
 *  hamlelerinde harf yoktur, dokunulmaz. */
const TURKISH_PIECE_LETTERS: Record<string, string> = {
  K: 'Ş', Q: 'V', R: 'K', B: 'F', N: 'A',
};

/**
 * Analiz Et sekmesi — madde 2026-08-31 (2): notasyon Türkçe yürütülür. SAN'ın
 * baştaki taş harfini (varsa) ve terfi harfini (=Q gibi) Türkçe karşılığına
 * çevirir; kare adları (a-h, 1-8), al/şah/mat işaretleri (x, +, #) ve rok
 * notasyonu (O-O/O-O-O) DEĞİŞMEZ.
 */
export function toTurkishSan(san: string): string {
  if (!san || san.startsWith('O-O')) return san;
  const firstLetter = san[0];
  let result = TURKISH_PIECE_LETTERS[firstLetter] ? TURKISH_PIECE_LETTERS[firstLetter] + san.slice(1) : san;
  result = result.replace(/=([KQRBN])/, (_match, p: string) => `=${TURKISH_PIECE_LETTERS[p]}`);
  return result;
}

/**
 * Analiz Et sekmesi — motorun UCI hamle dizisini (pv) okunabilir SAN dizisine
 * çevirir. Geçersiz/eksik bir hamleye rastlarsa orada durur (o ana kadarki
 * geçerli kısmı döner) — bozuk bir devam dizisi tüm satırı iptal etmesin.
 */
export function pvUciToSan(fen: string, pvUci: string[]): string[] {
  let board: Chess;
  try {
    board = new Chess(fen);
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const uci of pvUci) {
    if (!uci || uci.length < 4) break;
    try {
      const mv = board.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      if (!mv) break;
      out.push(mv.san);
    } catch {
      break;
    }
  }
  return out;
}

/**
 * SAN dizisini "5. Nc3 Be7 6. g3 d5..." biçiminde, FEN'deki hamle numarasından
 * ve sıradaki taraftan başlayarak numaralandırır (görsel referans: lichess/
 * chess.com analiz paneli). Siyah sıradaysa ilk hamle "5...Be7" gibi "..." ile
 * başlar.
 */
export function formatContinuation(fen: string, sanMoves: string[]): string {
  if (sanMoves.length === 0) return '';
  const parts = fen.trim().split(/\s+/);
  const sideToMove: 'w' | 'b' = parts[1] === 'b' ? 'b' : 'w';
  let moveNumber = Number(parts[5]) || 1;

  const tokens: string[] = [];
  sanMoves.forEach((sanRaw, i) => {
    const san = toTurkishSan(sanRaw);
    const isWhiteMove = sideToMove === 'w' ? i % 2 === 0 : i % 2 !== 0;
    if (isWhiteMove) {
      tokens.push(`${moveNumber}.`, san);
    } else if (i === 0) {
      tokens.push(`${moveNumber}...`, san);
    } else {
      tokens.push(san);
    }
    if (!isWhiteMove) moveNumber += 1;
  });
  return tokens.join(' ');
}

/**
 * Motorun döndürdüğü skor, HER ZAMAN sıradaki tarafın açısındandır (UCI
 * protokolü). Eval bar ve satırlar geleneksel olarak BEYAZ açısından
 * gösterilir — bkz. components/admin/PositionAnalysisPanel.tsx'teki AYNI
 * dönüşüm.
 */
export function scoreForWhite(
  scoreCp: number | null, mate: number | null, sideToMove: 'w' | 'b',
): { cp: number | null; mate: number | null } {
  const sign = sideToMove === 'w' ? 1 : -1;
  return {
    cp: scoreCp !== null ? scoreCp * sign : null,
    mate: mate !== null ? mate * sign : null,
  };
}
