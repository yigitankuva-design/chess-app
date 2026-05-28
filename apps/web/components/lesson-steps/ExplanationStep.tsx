'use client';
import { motion } from 'framer-motion';
import { ChessBoard } from '@/components/ChessBoard';
import type { Square } from 'chess.js';

interface Props {
  content: {
    title?: string;
    body?: string;
    fen?: string;
    highlight_squares?: string[];
  };
  onContinue: () => void;
}

export function ExplanationStep({ content, onContinue }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {content.title && <h2 className="text-2xl font-bold">{content.title}</h2>}
      {content.body && <p className="text-lg leading-relaxed">{content.body}</p>}
      {content.fen && (
        <ChessBoard
          fen={content.fen}
          highlightSquares={(content.highlight_squares || []) as Square[]}
        />
      )}
      <button
        onClick={onContinue}
        className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-medium hover:bg-blue-700 transition"
      >
        Devam →
      </button>
    </motion.div>
  );
}
