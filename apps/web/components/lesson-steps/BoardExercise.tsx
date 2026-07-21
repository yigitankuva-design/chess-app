'use client';
import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import { playPieceSound } from '@/lib/sounds/pieceSounds';

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
  exercises: BoardExerciseConfig[];
  done: boolean;
  onCorrect: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** True when sq is a standard chess dark square (a1 = dark, h1 = light). */
function isDarkSquare(sq: string): boolean {
  const file = sq.charCodeAt(0) - 97; // a=0 … h=7
  const rank = parseInt(sq[1], 10);   // 1–8
  return (file + rank) % 2 === 1;
}

/** Handles inverted DB data: if stored list contains known light squares, flip. */
function isTargetSquare(sq: string, targets: string[]): boolean {
  if (targets.length === 0) return false;
  const dbInverted = targets.includes('h1') || targets.includes('a2') || targets.includes('b1');
  return dbInverted ? isDarkSquare(sq) : targets.includes(sq);
}

// ─── Progress dots ────────────────────────────────────────────────────────────
function ProgressDots({ total, current, doneCount }: { total: number; current: number; doneCount: number }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: i < doneCount
              ? '#16a34a'        // completed
              : i === current
              ? 'var(--t-accent)' // current
              : 'var(--t-border)', // future
            transition: 'background 0.2s',
          }}
        />
      ))}
      <span className="text-xs ml-1" style={{ color: 'var(--t-muted)' }}>
        {doneCount}/{total}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BoardExercise({ exercises, done, onCorrect }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [doneCount, setDoneCount] = useState(done ? exercises.length : 0);
  const [status, setStatus] = useState<'idle' | 'success' | 'fail'>(done ? 'success' : 'idle');
  const [feedback, setFeedback] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showNext, setShowNext] = useState(false);

  const exercise = exercises[currentIdx] ?? exercises[0];
  const total = exercises.length;

  // Reset per-exercise state when index changes
  useEffect(() => {
    if (done) return;
    setStatus('idle');
    setFeedback('');
    setSelected(null);
    setShowNext(false);
  }, [currentIdx, done]);

  const succeed = (piece?: string | null) => {
    if (piece) playPieceSound(piece);
    setStatus('success');
    setSelected(null);
    const next = doneCount + 1;
    setDoneCount(next);
    if (next >= total) {
      if (!done) onCorrect();
    } else {
      setShowNext(true);
    }
  };

  const fail = (msg: string) => {
    setStatus('fail');
    setFeedback(msg);
    setSelected(null);
    setTimeout(() => setStatus('idle'), 1800);
  };

  const goNext = () => {
    setCurrentIdx((i) => Math.min(i + 1, total - 1));
    setShowNext(false);
  };

  // ── Square styles ──────────────────────────────────────────────────────────
  const styles: Record<string, CSSProperties> = {};

  if (status !== 'success' || showNext) {
    if (exercise.type !== 'identify_piece') {
      (exercise.hint_squares ?? []).forEach((sq) => {
        styles[sq] = { backgroundColor: 'rgba(255,200,0,0.50)' };
      });
    }
    if (exercise.type === 'identify_piece') {
      styles[exercise.highlight_square] = { backgroundColor: 'rgba(255,200,0,0.65)' };
    }
    if (selected) {
      styles[selected] = { backgroundColor: 'rgba(80,160,255,0.65)', cursor: 'pointer' };
    }
  }

  if (status === 'success' && exercise.type === 'move_piece') {
    exercise.target_squares.forEach((sq) => {
      styles[sq] = { backgroundColor: 'rgba(100,220,100,0.45)' };
    });
  }

  // ── Click handler ──────────────────────────────────────────────────────────
  const onSquareClick = ({ square, piece }: { square: string; piece: { pieceType: string } | null }) => {
    if (status === 'success') return;

    if (exercise.type === 'click_square') {
      if (piece) playPieceSound(piece.pieceType);
      if (isTargetSquare(square, exercise.target_squares)) {
        succeed();
      } else {
        fail(exercise.fail_msg ?? 'Yanlış kare! Tekrar dene.');
      }
      return;
    }

    if (exercise.type === 'move_piece') {
      if (!selected) {
        if (square === exercise.piece_square) {
          setSelected(square);
          if (piece) playPieceSound(piece.pieceType);
        }
        return;
      }
      if (square === exercise.piece_square) {
        setSelected(null);
        return;
      }
      if (exercise.target_squares.includes(square)) {
        succeed(piece?.pieceType);
      } else {
        fail(exercise.fail_msg ?? 'Yanlış kare! Altın renkli kareye taşı.');
      }
    }
  };

  // ── If all done and no more exercises ──────────────────────────────────────
  if (done && !showNext) {
    return (
      <div className="mt-2 pt-3 space-y-2" style={{ borderTop: '1px solid var(--t-border)' }}>
        <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold"
          style={{ background: '#dcfce7', color: '#15803d' }}>
          ✓ Tüm egzersizler tamamlandı!
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 mt-2 pt-3" style={{ borderTop: '1px solid var(--t-border)' }}>

      {/* Progress */}
      <div className="flex items-center justify-between">
        <ProgressDots total={total} current={currentIdx} doneCount={doneCount} />
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'var(--t-surface-2)', color: 'var(--t-muted)' }}>
          Soru {currentIdx + 1}/{total}
        </span>
      </div>

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

      {/* Instruction — tahtanın altında kart olarak */}
      <div className="flex items-start gap-3 py-3 px-4 rounded-xl"
        style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
        <span className="text-xl leading-none flex-shrink-0">🎯</span>
        <p className="text-sm font-semibold flex-1">{exercise.instruction}</p>
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

      {/* Feedback — dikkat çekici ve ilgi çekici */}
      {status === 'success' && (
        <div className="bea-pop relative flex items-center gap-3 py-3.5 px-4 rounded-2xl text-base font-extrabold overflow-visible"
          style={{
            background: 'linear-gradient(90deg, #22c55e, #16a34a)',
            color: '#fff',
            boxShadow: '0 8px 24px -6px rgba(34,197,94,0.6)',
          }}>
          <span className="text-2xl bea-bounce flex-shrink-0">🎉</span>
          <span>{exercise.success_msg ?? 'Aferin! Doğru yaptın! 👏'}</span>
          {/* yukarı süzülen emoji patlaması */}
          <div className="bea-burst pointer-events-none absolute inset-0">
            {['⭐', '✨', '🎊', '⭐', '✨'].map((e, i) => (
              <span key={i} style={{ left: `${12 + i * 19}%`, top: '40%', fontSize: 18, animationDelay: `${i * 0.06}s` }}>{e}</span>
            ))}
          </div>
        </div>
      )}
      {status === 'fail' && (
        <div className="bea-shake flex items-center gap-3 py-3 px-4 rounded-2xl text-sm font-bold"
          style={{
            background: 'linear-gradient(90deg, #f59e0b, #ef4444)',
            color: '#fff',
            boxShadow: '0 6px 18px -6px rgba(239,68,68,0.5)',
          }}>
          <span className="text-2xl flex-shrink-0">🤔</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* Next exercise button */}
      {showNext && doneCount < total && (
        <button
          onClick={goNext}
          className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'var(--t-accent)', color: '#fff' }}>
          Sonraki Soru →
        </button>
      )}
    </div>
  );
}
