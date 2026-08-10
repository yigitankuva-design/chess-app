import { Chess } from 'chess.js';

export type FenParseResult =
  | { ok: true; fen: string; turn: 'w' | 'b' }
  | { ok: false };

/**
 * Hoca'nın başka bir uygulamadan kopyalayıp yapıştırdığı FEN'i kontrol eder.
 *
 * Geçerliyse temizlenmiş FEN'i ve içindeki hamle sırasını döner; geçersizse
 * sadece `ok: false`. Kontrol için projenin zaten kullandığı chess.js'e
 * güvenilir — ayrı bir FEN kuralı YAZILMAZ (iki farklı doğruluk tanımı olmasın).
 *
 * Not: chess.js şahsız konumu kabul etmez; bu bizim için doğru davranıştır,
 * çünkü bu konumlar bota karşı OYNANACAK.
 */
/**
 * FEN'in hamle sırası alanını (2. alan) değiştirir. Hoca yapıştırdığı konumun
 * sırasını elle düzelttiğinde kullanılır — konum havuzunda sıra ayrı bir alanda
 * DEĞİL, FEN'in kendi içinde tutulur.
 */
export function withTurn(fen: string, turn: 'w' | 'b'): string {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 2) return fen;
  parts[1] = turn;
  return parts.join(' ');
}

export function parseFenInput(raw: string): FenParseResult {
  const fen = raw.trim();
  if (!fen) return { ok: false };
  try {
    const board = new Chess(fen);
    return { ok: true, fen, turn: board.turn() };
  } catch {
    return { ok: false };
  }
}
