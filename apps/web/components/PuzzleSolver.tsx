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
  const [moveIndex, setMoveIndex] = useState(1); // player must play moves[1] first
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [recorded, setRecorded] = useState(false);

  // On mount: auto-play opponent setup move (moves[0])
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

    // Compare ignoring promotion char (expected may be 'e7e8q')
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

      // Auto-play opponent reply
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
    <div className="max-w-2xl mx-auto space-y-4 p-4">
      <div className="flex gap-2 flex-wrap">
        {themes.map((t) => (
          <span key={t} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">{t}</span>
        ))}
      </div>
      <p className="text-lg opacity-75">
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
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="p-4 bg-green-100 border border-green-400 rounded-lg text-green-800 text-lg">
            ✓ Süper! Çözdün!
          </motion.div>
        )}
        {feedback === 'wrong' && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="p-4 bg-red-100 border border-red-400 rounded-lg text-red-800 text-lg flex items-center justify-between">
            <span>Olmadı, tekrar dene</span>
            <button onClick={retry} className="underline font-medium">Baştan</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
