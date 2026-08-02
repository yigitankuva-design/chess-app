'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Square } from 'chess.js';
import { ChessBoard } from '@/components/ChessBoard';
import { StockfishEngine } from '@/lib/chess/stockfish';
import {
  playerState, tryStudentMove, opponentKeyMove, isSequenceComplete, appendUciMove,
} from '@/lib/chess/movePlayer';
import { fensFromSan } from '@/lib/play/moveNavigation';
import { useMoveHistoryNav } from '@/lib/chess/useMoveHistoryNav';
import { HistoryBanner } from '@/components/play/HistoryBanner';
import type { MovePieceSequenceEx } from './BoardExercise';

/** Rakibin cevabı gözle takip edilebilsin diye kısa gecikme (PuzzleSolver ile aynı). */
const OPPONENT_DELAY_MS = 450;
/** Çocuk dostu hız için düşük derinlik (BotGame ile aynı varsayılan). */
const ENGINE_DEPTH = 8;

interface Props {
  exercise: MovePieceSequenceEx;
  /** Soru cevaplanmışsa tahta etkileşimsiz olur. */
  disabled: boolean;
  onSolved: () => void;
  onWrong: (msg: string) => void;
}

export function MovePieceSolver({ exercise, disabled, onSolved, onWrong }: Props) {
  const [playedMoves, setPlayedMoves] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const engineRef = useRef<StockfishEngine | null>(null);

  // Bileşen kaldırılırken motoru kapat — worker sızıntısı olmasın.
  useEffect(() => () => {
    engineRef.current?.destroy();
    engineRef.current = null;
  }, []);

  const state = playerState(exercise.fen, playedMoves);
  const studentSide = playerState(exercise.fen, []).turn;

  // playedMoves SAN tutar (bkz. lib/chess/movePlayer.ts) — dogrudan beslenir.
  const fens = useMemo(
    () => fensFromSan(exercise.fen, playedMoves),
    [exercise.fen, playedMoves],
  );
  const nav = useMoveHistoryNav(fens);

  /** Rakibin cevabı: önce cevap anahtarı, yoksa motor. */
  async function playOpponentReply(afterStudent: string[]) {
    const keyMove = opponentKeyMove(exercise.moves, afterStudent);
    if (keyMove) {
      const next = [...afterStudent, keyMove];
      setPlayedMoves(next);
      if (isSequenceComplete(exercise.moves, next)) onSolved();
      return;
    }

    // Anahtarda rakip cevabı yok → motora sor.
    setThinking(true);
    try {
      if (!engineRef.current) {
        engineRef.current = new StockfishEngine();
        await engineRef.current.init();
      }
      const fenNow = playerState(exercise.fen, afterStudent).fen;
      const uci = await engineRef.current.bestMove(fenNow, ENGINE_DEPTH);
      const next = appendUciMove(exercise.fen, afterStudent, uci);
      if (next) {
        setPlayedMoves(next);
        if (isSequenceComplete(exercise.moves, next)) onSolved();
      } else {
        // Motor hamle üretemedi ("(none)") → rakibin hamlesi yok, soru tamamlandı.
        onSolved();
      }
    } catch {
      // Motor yüklenemedi/hata verdi → soruyu güvenle tamamla, çökme yok.
      onSolved();
    } finally {
      setThinking(false);
    }
  }

  /** ChessBoard hem sürüklemeyi hem tıkla-tıkla akışını buraya yönlendirir. */
  function handleMove(from: Square, to: Square): boolean {
    if (disabled || thinking) return false;

    const result = tryStudentMove(exercise.fen, exercise.moves, playedMoves, from, to);

    if (result.kind === 'illegal') return false; // taş yerine döner, ceza yok
    if (result.kind === 'wrong') {
      onWrong(exercise.fail_msg ?? 'Bu hamle doğru değil.');
      return false;
    }

    setPlayedMoves(result.playedMoves);
    if (isSequenceComplete(exercise.moves, result.playedMoves)) {
      onSolved();
      return true;
    }
    setTimeout(() => { void playOpponentReply(result.playedMoves); }, OPPONENT_DELAY_MS);
    return true;
  }

  return (
    <div className="space-y-2">
      <ChessBoard
        fen={nav.isLive ? state.fen : nav.viewFen}
        interactive={!disabled && !thinking && nav.isLive}
        onPieceDrop={handleMove}
        boardOrientation={studentSide === 'w' ? 'white' : 'black'}
        onWheelStep={nav.step}
        historyView={!nav.isLive}
        onLeaveHistory={nav.goLive}
      />
      <HistoryBanner isLive={nav.isLive} viewIndex={nav.viewIndex} onGoLive={nav.goLive} />
      {thinking && (
        <p className="text-xs" style={{ color: 'var(--t-muted)' }}>Rakip düşünüyor…</p>
      )}
    </div>
  );
}
