'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChessBoard } from '@/components/ChessBoard';
import { getToken } from '@/lib/auth-storage';
import type { Square } from 'chess.js';

interface Props {
  stepId: number;
  lessonId: number;
  content: {
    title?: string;
    body?: string;
    fen?: string;
    task_type?: 'click_square' | 'make_move';
  };
  onContinue: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function InlineExerciseStep({ stepId, lessonId, content, onContinue }: Props) {
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitAnswer(answer: Record<string, unknown>) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/lessons/${lessonId}/step/${stepId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ answer_json: answer, time_seconds: 5 }),
      });
      const data = await res.json();
      setFeedback(data.correct ? 'correct' : 'wrong');
    } catch {
      setFeedback('wrong');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSquareClick(sq: Square) {
    if (content.task_type === 'click_square' && !feedback) {
      submitAnswer({ square: sq });
    }
  }

  function handlePieceDrop(from: Square, to: Square): boolean {
    if (content.task_type === 'make_move' && !feedback) {
      submitAnswer({ from, to });
      return true;
    }
    return false;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold mb-2">{content.title || 'Şimdi sen dene!'}</h2>
        {content.body && <p className="text-base t-muted">{content.body}</p>}
      </div>

      {content.fen && (
        <ChessBoard
          fen={content.fen}
          interactive={feedback !== 'correct'}
          onSquareClick={handleSquareClick}
          onPieceDrop={handlePieceDrop}
        />
      )}

      <AnimatePresence>
        {feedback === 'correct' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="t-ok p-4 font-semibold"
          >
            ✓ Doğru! Harika!
          </motion.div>
        )}
        {feedback === 'wrong' && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="t-err p-4 flex items-center justify-between"
          >
            <span className="font-medium">Yanlış, tekrar dene</span>
            <button onClick={() => setFeedback(null)} className="text-xs underline opacity-80 hover:opacity-100">
              Tekrar dene
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {feedback === 'correct' && (
        <button onClick={onContinue} className="t-btn w-full py-3 text-base font-medium">
          Devam →
        </button>
      )}
    </div>
  );
}
