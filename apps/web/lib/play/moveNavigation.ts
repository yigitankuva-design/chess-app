/** Hamle geçmişinde gezinme — saf mantık (madde 1). React yok, DOM yok.
 *
 *  Bu modül YALNIZCA GÖRÜNTÜ üretir: hamle geri almaz, hamle değiştirmez.
 *  Sporcu geçmişe baktığında tahtanın salt-okunur olması çağıran bileşenin
 *  sorumluluğudur (ChessBoard `interactive={false}` alır).
 */
import { Chess } from 'chess.js';

/**
 * Başlangıç konumu + SAN hamlelerinden her yarı-hamle sonrası FEN üretir.
 * Dönen dizinin 0. elemanı BAŞLANGIÇ konumu, i. elemanı i. hamleden sonraki
 * konumdur; uzunluk `san.length + 1`.
 *
 * ŞAHSIZ POZİSYON DESTEĞİ — `skipValidation` ZORUNLU. Zafer Hoca'nın öğretim
 * pozisyonları kasten şahsızdır; bu seçenek olmadan chess.js
 * `Invalid FEN: missing white king` ile çöker (bkz. lib/chess/movePlayer.ts).
 */
export function fensFromSan(startFen: string | undefined | null, san: string[]): string[] {
  const board = startFen
    ? new Chess(startFen, { skipValidation: true })
    : new Chess();
  const out: string[] = [board.fen()];
  for (const move of san) {
    try {
      board.move(move);
    } catch {
      break; // bozuk kayıt — oynatılabildiği yere kadar
    }
    out.push(board.fen());
  }
  return out;
}

/** Görüntüleme sırasını listenin sınırlarına çeker. Bozuk/taşan değer
 *  ekranı kilitlemesin diye her okumada uygulanır. */
export function clampViewIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}
