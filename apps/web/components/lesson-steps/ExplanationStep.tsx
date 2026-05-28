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
      className="space-y-5"
    >
      {content.title && <h2 className="text-xl font-bold">{content.title}</h2>}
      {content.body && <p className="text-base leading-relaxed t-muted">{content.body}</p>}
      {content.fen && (
        <ChessBoard
          fen={content.fen}
          highlightSquares={(content.highlight_squares || []) as Square[]}
        />
      )}
      <button onClick={onContinue} className="t-btn w-full py-3 text-base font-medium">
        Devam →
      </button>
    </motion.div>
  );
}
