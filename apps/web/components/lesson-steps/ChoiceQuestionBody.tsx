'use client';
import type { ChoiceTypeConfig } from './BoardExercise';
import { EmptyBoardGrid } from '@/components/chess/EmptyBoardGrid';
import { toneToFilter } from '@/lib/chess/imagePlacement';

interface Props {
  exercise: ChoiceTypeConfig;
  disabled: boolean;
  onAnswer: (index: number) => void;
}

export function ChoiceQuestionBody({ exercise, disabled, onAnswer }: Props) {
  const gridCols = exercise.options.length === 2 ? 'grid-cols-2'
    : exercise.options.length === 3 ? 'grid-cols-3'
    : 'grid-cols-2';

  const hasPlacement = exercise.type === 'image_question' && exercise.image_x !== undefined;

  return (
    <>
      {exercise.type === 'image_question' && !hasPlacement && (
        <div className="rounded-xl overflow-hidden" style={{ maxWidth: 340, margin: '0 auto' }}>
          <img src={exercise.prompt_image} alt="Soru görseli"
            style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }} />
        </div>
      )}

      {exercise.type === 'image_question' && hasPlacement && (
        <div style={{ maxWidth: 340, margin: '0 auto' }}>
          {exercise.image_show_board !== false ? (
            <EmptyBoardGrid>
              <img src={exercise.prompt_image} alt="Soru görseli" draggable={false}
                style={{
                  position: 'absolute',
                  left: `${exercise.image_x}%`, top: `${exercise.image_y}%`,
                  width: `${exercise.image_w}%`, height: `${exercise.image_h}%`,
                  transform: 'translate(-50%, -50%)',
                  filter: toneToFilter(exercise.image_tone ?? 0),
                  objectFit: 'contain',
                }} />
            </EmptyBoardGrid>
          ) : (
            <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
              <img src={exercise.prompt_image} alt="Soru görseli" draggable={false}
                style={{
                  position: 'absolute',
                  left: `${exercise.image_x}%`, top: `${exercise.image_y}%`,
                  width: `${exercise.image_w}%`, height: `${exercise.image_h}%`,
                  transform: 'translate(-50%, -50%)',
                  filter: toneToFilter(exercise.image_tone ?? 0),
                  objectFit: 'contain',
                }} />
            </div>
          )}
        </div>
      )}

      {exercise.instruction && (
        <div className="flex items-start gap-3 py-3 px-4 rounded-xl"
          style={{ background: 'var(--t-surface-2)', border: '1px solid var(--t-border)' }}>
          <span className="text-xl leading-none flex-shrink-0">🎯</span>
          <p className="text-sm font-semibold flex-1">{exercise.instruction}</p>
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
