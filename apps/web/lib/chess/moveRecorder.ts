import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

/**
 * ŞAHSIZ POZİSYON DESTEĞİ — `skipValidation` ZORUNLU.
 *
 * Zafer Hoca'nın öğretim pozisyonları kasten şahsızdır (boş tahta + tek piyon).
 * Bu seçenek olmadan chess.js `Invalid FEN: missing white king` hatasıyla ÇÖKER.
 * (Gerçek ortamda ölçüldü.)
 */
function newRecorderChess(fen: string): Chess {
  return new Chess(fen, { skipValidation: true });
}

/** Başlangıç pozisyonundan itibaren SAN hamlelerini oynatır. */
function replayMoves(fen: string, moves: string[]): Chess {
  const board = newRecorderChess(fen);
  for (const san of moves) {
    try {
      board.move(san);
    } catch {
      break; // bozuk kayıt — oynatılabildiği yere kadar
    }
  }
  return board;
}

export interface RecorderState {
  /** Kaydedilen hamlelerden sonraki güncel pozisyon. */
  fen: string;
  /** Sırası gelen taraf. */
  turn: 'w' | 'b';
  /** Sıradaki tarafın hiç legal hamlesi yok mu? (tek renkli pozisyonlarda olur) */
  stuck: boolean;
}

export function recorderState(fen: string, moves: string[]): RecorderState {
  const board = replayMoves(fen, moves);
  return {
    fen: board.fen(),
    turn: board.turn(),
    stuck: board.moves().length === 0,
  };
}

/**
 * Sürüklenen hamleyi doğrular ve kabul edilirse yeni SAN dizisini döndürür.
 * Kural dışı / sıraya aykırı hamlede `null` döner (tahta taşı geri alır).
 */
export function tryAppendMove(
  fen: string,
  moves: string[],
  from: string,
  to: string,
): string[] | null {
  const board = replayMoves(fen, moves);
  try {
    // Terfi her zaman vezir — BotGame/LiveGame ile tutarlı proje geneli kısıtlama.
    const move = board.move({ from: from as Square, to: to as Square, promotion: 'q' });
    return [...moves, move.san];
  } catch {
    return null;
  }
}

export interface NotationRow {
  no: number;
  white: string;
  black: string;
}

/**
 * Hamleleri 3 sütunlu Notasyon Tablosu satırlarına böler.
 * Siyahın başladığı pozisyonlarda ilk satırın beyaz hücresi boş bırakılır.
 */
export function notationRows(fen: string, moves: string[]): NotationRow[] {
  const startsWithBlack = newRecorderChess(fen).turn() === 'b';
  const cells: string[] = startsWithBlack ? ['', ...moves] : [...moves];
  const rows: NotationRow[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push({ no: i / 2 + 1, white: cells[i] ?? '', black: cells[i + 1] ?? '' });
  }
  return rows;
}
