'use client';
import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { motion, AnimatePresence } from 'framer-motion';
import { getToken } from '@/lib/auth-storage';

interface Props {
  puzzleId: number;
  fen: string;
  solutionMoves: string[]; // UCI moves; moves[0] = opponent setup
  themes: string[];
  onComplete: (success: boolean) => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function PuzzleSolver({ puzzleId, fen, solutionMoves, themes, onComplete }: Props) {
  const chessRef = useRef(new Chess(fen));
  const [displayFen, setDisplayFen] = useState(fen);
  const [moveIndex, setMoveIndex] = useState(1);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    const chess = new Chess(fen);
    chessRef.current = chess;
    if (solutionMoves.length > 0) {
      const setup = solutionMoves[0];
      try {
        chess.move({ from: setup.slice(0, 2) as Square, to: setup.slice(2, 4) as Square, promotion: 'q' });
      } catch { /* ignore */ }
    }
    setDisplayFen(chess.fen());
    setOrientation(chess.turn() === 'w' ? 'white' : 'black');
    setMoveIndex(1);
    setFeedback(null);
    setRecorded(false);
  }, [fen, solutionMoves, puzzleId]);

  async function recordAttempt(success: boolean) {
    if (recorded) return;
    setRecorded(true);
    try {
      const token = getToken();
      await fetch(`${API_BASE}/puzzles/${puzzleId}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ success, time_seconds: 30, moves_attempted: [] }),
      });
    } catch { /* ignore */ }
  }

  function handleDrop(from: Square, to: Square): boolean {
    if (feedback === 'correct') return false;
    const expected = solutionMoves[moveIndex];
    if (!expected) return false;
    const userUci = `${from}${to}`;

    if (userUci === expected.slice(0, 4)) {
      const chess = chessRef.current;
      try {
        chess.move({ from, to, promotion: 'q' });
      } catch {
        return false;
      }
      setDisplayFen(chess.fen());
      const nextIdx = moveIndex + 1;

      if (nextIdx >= solutionMoves.length) {
        setFeedback('correct');
        recordAttempt(true);
        onComplete(true);
        return true;
      }

      setTimeout(() => {
        const reply = solutionMoves[nextIdx];
        try {
          chess.move({ from: reply.slice(0, 2) as Square, to: reply.slice(2, 4) as Square, promotion: 'q' });
          setDisplayFen(chess.fen());
        } catch { /* ignore */ }
        setMoveIndex(nextIdx + 1);
      }, 450);
      return true;
    } else {
      setFeedback('wrong');
      recordAttempt(false);
      return false;
    }
  }

  function retry() {
    const chess = new Chess(fen);
    if (solutionMoves.length > 0) {
      const setup = solutionMoves[0];
      try {
        chess.move({ from: setup.slice(0, 2) as Square, to: setup.slice(2, 4) as Square, promotion: 'q' });
      } catch { /* ignore */ }
    }
    chessRef.current = chess;
    setDisplayFen(chess.fen());
    setMoveIndex(1);
    setFeedback(null);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-4 space-y-3">
      {themes.length > 0 && (
        <div className="flex gap-1.5 flex-wrap pt-2">
          {themes.map((t) => (
            <span key={t} className="t-tag">{t}</span>
          ))}
        </div>
      )}
      <p className="text-sm t-muted">
        {orientation === 'white' ? 'Beyaz' : 'Siyah'} oynar — en iyi hamleyi bul!
      </p>
      <ChessBoard
        fen={displayFen}
        interactive={feedback !== 'correct'}
        onPieceDrop={handleDrop}
        boardOrientation={orientation}
      />
      <AnimatePresence>
        {feedback === 'correct' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="t-ok p-4 text-center font-semibold"
          >
            ✓ Süper! Çözdün!
          </motion.div>
        )}
        {feedback === 'wrong' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="t-err p-4 flex items-center justify-between"
          >
            <span className="font-medium">Olmadı, tekrar dene</span>
            <button onClick={retry} className="text-xs underline opacity-80 hover:opacity-100">
              Baştan
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
