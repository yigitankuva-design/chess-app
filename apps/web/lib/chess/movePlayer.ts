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
  /** Sıra sporcuda mı? (varsayılan parite 0'da çift sayıda hamle oynanmışsa evet) */
  isStudentTurn: boolean;
}

/**
 * Sporcu `playedMoves.length % 2 === studentParity` olduğunda oynar.
 * Varsayılan 0 — MEVCUT davranış (sporcu her zaman İLK hamleyi oynar,
 * ders içeriğindeki move_piece soruları bunu hiç değiştirmez). Madde
 * 2026-09-02 (devam) — b) Teori Pratiği: notasyon her zaman doğal sırayla
 * kaydedilir (genelde beyazdan), ama sporcu SİYAH oynayacaksa parity 1
 * olur — o zaman ilk hamle (index 0) RAKİBİN, sporcu ikinci hamleden
 * (index 1) başlar. Çağıran taraf (TeoriPratigiSolver) bu durumda mount'ta
 * rakibin ilk hamlesini kendisi oynatır.
 */
export function playerState(
  fen: string, playedMoves: string[], studentParity: 0 | 1 = 0,
): PlayerState {
  const board = replay(fen, playedMoves);
  return {
    fen: board.fen(),
    turn: board.turn(),
    isStudentTurn: playedMoves.length % 2 === studentParity,
  };
}

/**
 * Sporcunun sırasıysa cevap anahtarında beklenen SAN hamlesi; rakibin
 * sırasıysa veya anahtar bittiyse null.
 */
export function expectedStudentMove(
  answerKey: string[],
  playedMoves: string[],
  studentParity: 0 | 1 = 0,
): string | null {
  if (playedMoves.length % 2 !== studentParity) return null; // rakip sırası
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
  studentParity: 0 | 1 = 0,
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
  const expected = expectedStudentMove(answerKey, playedMoves, studentParity);
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
  studentParity: 0 | 1 = 0,
): string | null {
  if (playedMoves.length % 2 === studentParity) return null; // sporcu sırası
  return answerKey[playedMoves.length] ?? null;
}

/** Sporcunun cevap anahtarında oynayacağı başka hamle kalmadı mı? */
export function isSequenceComplete(
  answerKey: string[],
  playedMoves: string[],
  studentParity: 0 | 1 = 0,
): boolean {
  return playedMoves.length % 2 === studentParity && answerKey[playedMoves.length] === undefined;
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
