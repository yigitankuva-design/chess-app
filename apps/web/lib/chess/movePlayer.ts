import { Chess } from 'chess.js';
import type { Square } from 'chess.js';

/**
 * ŞAHSIZ POZİSYON DESTEĞİ — `skipValidation` ZORUNLU.
 * Zafer Hoca'nın öğretim pozisyonları kasten şahsızdır; bu seçenek olmadan
 * chess.js `Invalid FEN: missing white king` ile çöker (ölçüldü).
 */
function newPlayerChess(fen: string): Chess {
  return new Chess(fen, { skipValidation: true });
}

/** Başlangıç pozisyonundan itibaren oynanmış SAN hamlelerini uygular. */
function replay(fen: string, playedMoves: string[]): Chess {
  const board = newPlayerChess(fen);
  for (const san of playedMoves) {
    try {
      board.move(san);
    } catch {
      break; // bozuk kayıt — oynatılabildiği yere kadar
    }
  }
  return board;
}

export interface PlayerState {
  /** Oynanan hamlelerden sonraki güncel pozisyon. */
  fen: string;
  /** Sırası gelen taraf. */
  turn: 'w' | 'b';
  /** Sıra sporcuda mı? (çift sayıda hamle oynanmışsa evet) */
  isStudentTurn: boolean;
}

export function playerState(fen: string, playedMoves: string[]): PlayerState {
  const board = replay(fen, playedMoves);
  return {
    fen: board.fen(),
    turn: board.turn(),
    isStudentTurn: playedMoves.length % 2 === 0,
  };
}

/**
 * Sporcunun sırasıysa cevap anahtarında beklenen SAN hamlesi; rakibin
 * sırasıysa veya anahtar bittiyse null.
 */
export function expectedStudentMove(
  answerKey: string[],
  playedMoves: string[],
): string | null {
  if (playedMoves.length % 2 !== 0) return null; // rakip sırası
  return answerKey[playedMoves.length] ?? null;
}

export type StudentMoveResult =
  | { kind: 'illegal' }
  | { kind: 'wrong'; san: string }
  | { kind: 'correct'; playedMoves: string[] };

/**
 * Sporcunun oynamak istediği hamleyi değerlendirir:
 *  - `illegal`: satranç kurallarına aykırı → taş yerine döner, YANLIŞ CEVAP SAYILMAZ
 *  - `wrong`:   legal ama cevap anahtarındaki hamle değil → yanlış cevap
 *  - `correct`: anahtarla eşleşiyor → güncellenmiş hamle dizisi
 */
export function tryStudentMove(
  fen: string,
  answerKey: string[],
  playedMoves: string[],
  from: string,
  to: string,
): StudentMoveResult {
  const board = replay(fen, playedMoves);
  let san: string;
  try {
    // Terfi her zaman vezir — BotGame/LiveGame/MoveRecorderBoard ile tutarlı.
    const move = board.move({ from: from as Square, to: to as Square, promotion: 'q' });
    san = move.san;
  } catch {
    return { kind: 'illegal' };
  }
  const expected = expectedStudentMove(answerKey, playedMoves);
  if (expected === null || san !== expected) {
    return { kind: 'wrong', san };
  }
  return { kind: 'correct', playedMoves: [...playedMoves, san] };
}

/**
 * Rakibin sırasıysa cevap anahtarındaki hamlesi; anahtarda yoksa null
 * (bu durumda çağıran taraf motora sorar).
 */
export function opponentKeyMove(
  answerKey: string[],
  playedMoves: string[],
): string | null {
  if (playedMoves.length % 2 === 0) return null; // sporcu sırası
  return answerKey[playedMoves.length] ?? null;
}

/** Sporcunun cevap anahtarında oynayacağı başka hamle kalmadı mı? */
export function isSequenceComplete(
  answerKey: string[],
  playedMoves: string[],
): boolean {
  return playedMoves.length % 2 === 0 && answerKey[playedMoves.length] === undefined;
}

/**
 * Motorun UCI cevabını ('g8f8') SAN'a çevirip diziye ekler.
 * '(none)', boş cevap veya kural dışı hamlede null döner — çağıran taraf
 * bunu "rakibin hamlesi yok" olarak yorumlar ve soruyu tamamlar.
 */
export function appendUciMove(
  fen: string,
  playedMoves: string[],
  uci: string,
): string[] | null {
  if (!uci || uci === '(none)' || uci.length < 4) return null;
  const board = replay(fen, playedMoves);
  try {
    const move = board.move({
      from: uci.slice(0, 2) as Square,
      to: uci.slice(2, 4) as Square,
      promotion: 'q',
    });
    return [...playedMoves, move.san];
  } catch {
    return null;
  }
}
