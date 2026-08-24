'use client';
import { useState } from 'react';
import { ExerciseForm } from './ExerciseForm';
import type { BoardExercise, ExerciseType } from './ExerciseForm';
import { CollapsibleCard } from './CollapsibleCard';
import { assignExerciseCodes } from '@/lib/exerciseCodes';
import { exerciseBadgeTitle } from '@/lib/exerciseBadge';
import { difficultyColor } from '@/lib/difficultyLabels';

/** Alt Konu'da yalnızca bu 3 tür kabul edilir — antrenörün kendi gösterimi
 *  için (madde 2026-08-24), "Taş Nerde?"/"Taşı Tanı" ve Cümle/Görüntü
 *  soruları burada YOKTUR (sporcu cevaplamaz, ekleme anlamsız). */
const ALT_KONU_BOARD_TYPES: ExerciseType[] = ['click_square', 'click_piece', 'move_piece'];

interface Props {
  exercises: BoardExercise[];
  onAdd: (ex: BoardExercise) => Promise<void>;
  onUpdate: (idx: number, ex: BoardExercise) => Promise<void>;
  onDelete: (idx: number) => Promise<void>;
}

/**
 * Alt Konu'da "Kareye Tıkla / Taşa Tıkla / Taşı Oynat" soruları — madde:
 * 2026-08-24. Derslerdeki (Süresiz Pratik Yap) soru havuzuyla AYNI görsel dil
 * (numaralı dairesel kartlar, ExerciseForm ile ekle/düzenle) ama antrenörün
 * KENDİ gösterimi içindir — sporcu CEVAPLAMAZ, doğru/yanlış kontrolü yoktur.
 */
export function AltKonuExercisesFields({ exercises, onAdd, onUpdate, onDelete }: Props) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const codes = assignExerciseCodes(exercises);

  return (
    <div className="space-y-3">
      {exercises.length > 0 && (
        <CollapsibleCard title="Soru Havuzu" badge={`${exercises.length} soru`}>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
            {exercises.map((ex, idx) => {
              const editingThis = editingIdx === idx;
              const circleColor = difficultyColor(ex.difficulty ?? 1);
              return (
                <button
                  key={idx}
                  type="button"
                  title={exerciseBadgeTitle(ex)}
                  onClick={() => setEditingIdx(editingThis ? null : idx)}
                  className="aspect-square rounded-full flex items-center justify-center font-mono font-bold transition-all"
                  style={{
                    fontSize: '0.85rem',
                    border: `1.5px solid ${circleColor}`,
                    background: editingThis ? circleColor : `color-mix(in srgb, ${circleColor} 12%, transparent)`,
                    color: editingThis ? '#0b0f1a' : circleColor,
                    boxShadow: editingThis ? `0 0 12px -2px ${circleColor}` : 'none',
                  }}
                >
                  {codes[idx]}
                </button>
              );
            })}
          </div>
        </CollapsibleCard>
      )}

      {editingIdx !== null ? (
        <div className="space-y-2">
          <button type="button" onClick={() => onDelete(editingIdx).then(() => setEditingIdx(null))}
            className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">
            Soruyu sil
          </button>
          <ExerciseForm
            key={`edit-${editingIdx}`}
            initial={{ ...exercises[editingIdx], code: codes[editingIdx] }}
            onlyBoardFamily
            allowedBoardTypes={ALT_KONU_BOARD_TYPES}
            onSubmit={(ex) => onUpdate(editingIdx, ex)}
            onCancel={() => setEditingIdx(null)}
          />
        </div>
      ) : (
        <ExerciseForm
          key="add"
          onlyBoardFamily
          allowedBoardTypes={ALT_KONU_BOARD_TYPES}
          onSubmit={onAdd}
        />
      )}
    </div>
  );
}
