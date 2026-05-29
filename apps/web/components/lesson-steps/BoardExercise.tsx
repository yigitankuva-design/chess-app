'use client';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';

// ─── Exercise config types ────────────────────────────────────────────────────

export interface ClickSquareEx {
  type: 'click_square';
  instruction: string;
  fen: string;
  target_squares: string[];
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
}

export interface MovePieceEx {
  type: 'move_piece';
  instruction: string;
  fen: string;
  piece_square: string;
  target_squares: string[];
  hint_squares?: string[];
  success_msg?: string;
  fail_msg?: string;
}

export interface IdentifyPieceEx {
  type: 'identify_piece';
  instruction: string;
  fen: string;
  highlight_square: string;
  options: string[];
  correct_index: number;
  success_msg?: string;
}

export type BoardExerciseConfig = ClickSquareEx | MovePieceEx | IdentifyPieceEx;

interface Props {
  exercise: BoardExerciseConfig;
  done: boolean;
  onCorrect: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if the square is a dark square in standard chess.
 *  Formula: (fileIndex + rank) % 2 === 1  where a=0 … h=7, rank 1-8.
 *  a1 = dark, h1 = light (white's bottom-right is always light). */
function isDarkSquare(sq: string): boolean {
  const file = sq.charCodeAt(0) - 97; // 'a'→0 … 'h'→7
  const rank = parseInt(sq[1], 10);   // '1'→1 … '8'→8
  return (file + rank) % 2 === 1;
}

/** For click_square exercises that list ALL 32 dark (or light) squares,
 *  sanity-check: if the first target_square is actually a LIGHT square,
 *  the DB data is inverted — flip the check. */
function isTargetSquare(sq: string, targets: string[]): boolean {
  if (targets.length === 0) return false;
  // Detect inversion: if the stored targets contain known-light squares (h1)
  const dbIsInverted = targets.includes('h1') || targets.includes('a2') || targets.includes('b1');
  if (dbIsInverted) {
    // DB has light squares as "targets" for a dark-square exercise → correct on-the-fly
    return isDarkSquare(sq);
  }
  return targets.includes(sq);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BoardExercise({ exercise, done, onCorrect }: Props) {
  const [status, setStatus] = useState<'idle' | 'success' | 'fail'>(done ? 'success' : 'idle');
  const [feedback, setFeedback] = useState('');
  const [selected, setSelected] = useState<string | null>(null); // for move_piece: first click

  const succeed = () => {
    setStatus('success');
    setSelected(null);
    if (!done) onCorrect();
  };

  const fail = (msg: string) => {
    setStatus('fail');
    setFeedback(msg);
    setSelected(null);
    setTimeout(() => setStatus('idle'), 2000);
  };

  // ── Square style map ──────────────────────────────────────────────────────
  const styles: Record<string, CSSProperties> = {};

  if (status !== 'success') {
    // Hint squares — gold overlay
    if (exercise.type !== 'identify_piece') {
      (exercise.hint_squares ?? []).forEach((sq) => {
        styles[sq] = { backgroundColor: 'rgba(255,200,0,0.50)' };
      });
    }
    // Identify piece — highlight the piece
    if (exercise.type === 'identify_piece') {
      styles[exercise.highlight_square] = { backgroundColor: 'rgba(255,200,0,0.65)' };
    }
    // Selected piece (move_piece first-click) — blue overlay
    if (selected) {
      styles[selected] = { backgroundColor: 'rgba(80,160,255,0.65)', cursor: 'pointer' };
    }
  }

  if (status === 'success') {
    // Green tint on success
    if (exercise.type === 'move_piece') {
      exercise.target_squares.forEach((sq) => {
        styles[sq] = { backgroundColor: 'rgba(100,220,100,0.45)' };
      });
    }
  }

  // ── Click handler ─────────────────────────────────────────────────────────
  const onSquareClick = ({ square }: { square: string }) => {
    if (status === 'success') return;

    if (exercise.type === 'click_square') {
      if (isTargetSquare(square, exercise.target_squares)) {
        succeed();
      } else {
        fail(exercise.fail_msg ?? 'Yanlış kare! Tekrar dene.');
      }
      return;
    }

    if (exercise.type === 'move_piece') {
      if (!selected) {
        if (square === exercise.piece_square) setSelected(square);
        return;
      }
      if (square === exercise.piece_square) {
        setSelected(null); // deselect
        return;
      }
      if (exercise.target_squares.includes(square)) {
        succeed();
      } else {
        fail(exercise.fail_msg ?? 'Yanlış kare! Taşı sarı karelerden birine taşı.');
      }
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 mt-2 pt-3" style={{ borderTop: '1px solid var(--t-border)' }}>
      {/* Instruction */}
      <p className="text-sm font-semibold">{exercise.instruction}</p>

      {/* Board */}
      <div className="rounded-xl overflow-hidden shadow-sm" style={{ maxWidth: 340, margin: '0 auto' }}>
        <Chessboard
          options={{
            position: exercise.fen,
            allowDragging: false,
            squareStyles: styles,
            onSquareClick,
          }}
        />
      </div>

      {/* Multiple-choice for identify_piece */}
      {exercise.type === 'identify_piece' && status !== 'success' && (
        <div className="grid grid-cols-2 gap-2">
          {exercise.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => {
                if (i === exercise.correct_index) succeed();
                else fail('Yanlış! Tekrar bak ve dene.');
              }}
              className="py-2.5 px-3 rounded-lg text-sm font-medium transition-all"
              style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)' }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {/* Helper hint for move_piece */}
      {exercise.type === 'move_piece' && status === 'idle' && (
        <p className="text-xs" style={{ color: 'var(--t-muted)' }}>
          {selected ? '✔ Taş seçildi — şimdi hedef kareye tıkla!' : 'Önce taşa tıkla, sonra gideceği kareye tıkla.'}
        </p>
      )}

      {/* Feedback banners */}
      {status === 'success' && (
        <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold"
          style={{ background: '#dcfce7', color: '#15803d' }}>
          ✓ {exercise.success_msg ?? 'Doğru! Harika iş çıkardın.'}
        </div>
      )}
      {status === 'fail' && (
        <div className="flex items-center gap-2 py-2 px-3 rounded-xl text-sm"
          style={{ background: '#fee2e2', color: '#b91c1c' }}>
          ✗ {feedback}
        </div>
      )}
    </div>
  );
}
