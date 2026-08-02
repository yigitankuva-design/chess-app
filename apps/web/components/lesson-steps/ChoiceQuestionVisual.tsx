'use client';
import type { ChoiceTypeConfig } from './BoardExercise';
import { EmptyBoardGrid } from '@/components/chess/EmptyBoardGrid';
import { toneToFilter } from '@/lib/chess/imagePlacement';

interface Props {
  exercise: ChoiceTypeConfig;
}

/** Çoktan seçmeli sorunun GÖRSEL kısmı — resim veya boş tahta ızgarası.
 *  Yatay yerleşimde tahtanın olduğu alana (`board`) konur; cümle tipi
 *  sorularda hiçbir şey render etmez (görsel yok). */
export function ChoiceQuestionVisual({ exercise }: Props) {
  const hasMulti = exercise.type === 'image_question'
    && !!exercise.prompt_images && exercise.prompt_images.length > 0;
  const hasLegacyPlacement = exercise.type === 'image_question' && !hasMulti && exercise.image_x !== undefined;

  return (
    <>
      {exercise.type === 'image_question' && !hasMulti && !hasLegacyPlacement && (
        <div className="rounded-xl overflow-hidden" style={{ maxWidth: 340, margin: '0 auto' }}>
          <img src={exercise.prompt_image} alt="Soru görseli"
            style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }} />
        </div>
      )}

      {exercise.type === 'image_question' && hasLegacyPlacement && (
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

      {exercise.type === 'image_question' && hasMulti && (
        <div style={{ maxWidth: 340, margin: '0 auto' }}>
          {exercise.image_show_board !== false ? (
            <EmptyBoardGrid>
              {exercise.prompt_images!.map((img, i) => (
                <img key={i} src={img.uri} alt={`Görsel ${i + 1}`} draggable={false}
                  style={{
                    position: 'absolute',
                    left: `${img.x}%`, top: `${img.y}%`,
                    width: `${img.w}%`, height: `${img.h}%`,
                    transform: 'translate(-50%, -50%)',
                    filter: toneToFilter(img.tone),
                    objectFit: 'contain',
                  }} />
              ))}
            </EmptyBoardGrid>
          ) : (
            <div className="relative w-full" style={{ aspectRatio: '1 / 1' }}>
              {exercise.prompt_images!.map((img, i) => (
                <img key={i} src={img.uri} alt={`Görsel ${i + 1}`} draggable={false}
                  style={{
                    position: 'absolute',
                    left: `${img.x}%`, top: `${img.y}%`,
                    width: `${img.w}%`, height: `${img.h}%`,
                    transform: 'translate(-50%, -50%)',
                    filter: toneToFilter(img.tone),
                    objectFit: 'contain',
                  }} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
