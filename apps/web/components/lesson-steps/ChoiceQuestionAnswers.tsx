'use client';
import type { ChoiceTypeConfig } from './BoardExercise';

interface Props {
  exercise: ChoiceTypeConfig;
  disabled: boolean;
  onAnswer: (index: number) => void;
  /** Madde 2026-09-04 (5): talimat kutusundaki 🎯 ikonu render edilmez, metin
   *  ortalanır. Varsayılan false — SADECE a) Konum Pratiği bunu açar. */
  hideInstructionIcon?: boolean;
}

/** Çoktan seçmeli sorunun talimat kartı + şık butonları.
 *  Yatay yerleşimde tahtanın YANINDAKİ alana (`content`) konur. */
export function ChoiceQuestionAnswers({ exercise, disabled, onAnswer, hideInstructionIcon = false }: Props) {
  const gridCols = exercise.options.length === 2 ? 'grid-cols-2'
    : exercise.options.length === 3 ? 'grid-cols-3'
    : 'grid-cols-2';

  return (
    <>
      {exercise.instruction && (
        <div className="flex items-start gap-3 py-3 px-4 rounded-xl"
          style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
          {!hideInstructionIcon && <span className="text-xl leading-none flex-shrink-0">🎯</span>}
          <p className={`text-sm font-semibold flex-1${hideInstructionIcon ? ' text-center' : ''}`}>
            {exercise.instruction}
          </p>
        </div>
      )}

      <div className={`grid ${gridCols} gap-2`}>
        {exercise.options.map((opt, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onAnswer(i)}
            className="py-2.5 px-3 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
            style={{ border: '1px solid var(--t-border)', background: 'var(--t-surface)' }}
          >
            {exercise.answer_kind === 'image'
              ? <img src={opt} alt={`Seçenek ${i + 1}`} style={{ width: '100%', maxHeight: 96, objectFit: 'contain' }} />
              : opt}
          </button>
        ))}
      </div>
    </>
  );
}
