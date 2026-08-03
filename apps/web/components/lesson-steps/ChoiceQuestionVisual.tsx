'use client';
import type { ChoiceTypeConfig } from './BoardExercise';
import { EmptyBoardGrid } from '@/components/chess/EmptyBoardGrid';
import { toneToFilter } from '@/lib/chess/imagePlacement';
import { Chessboard } from 'react-chessboard';
import { BOARD_CARD_BG, BOARD_STYLE, getBoardColors, getPieceSet } from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';
import { PaintItemView } from '@/components/PaintItemView';

interface Props {
  exercise: ChoiceTypeConfig;
}

/** Çoktan seçmeli sorunun GÖRSEL kısmı — resim veya boş tahta ızgarası.
 *  Yatay yerleşimde tahtanın olduğu alana (`board`) konur; cümle tipi
 *  sorularda hiçbir şey render etmez (görsel yok) — YALNIZCA hoca opsiyonel
 *  bir tahta kurduysa (madde 5, `fen` doluysa) sabit tahta gösterilir. */
export function ChoiceQuestionVisual({ exercise }: Props) {
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = getPieceSet(settings.board.pieces);
  const hasMulti = exercise.type === 'image_question'
    && !!exercise.prompt_images && exercise.prompt_images.length > 0;
  const hasLegacyPlacement = exercise.type === 'image_question' && !hasMulti && exercise.image_x !== undefined;

  return (
    <>
      {exercise.type === 'sentence_question' && exercise.fen && exercise.sentence_show_board !== false && (
        <div data-testid="sentence-board" className="rounded-xl p-2" style={{ backgroundColor: BOARD_CARD_BG, maxWidth: 240, margin: '0 auto', position: 'relative' }}>
          <div className="aspect-square" style={BOARD_STYLE}>
            <Chessboard options={{
              position: exercise.fen,
              allowDragging: false,
              pieces: pieceSet,
              lightSquareStyle: { backgroundColor: boardColors.light },
              darkSquareStyle: { backgroundColor: boardColors.dark },
              showNotation: false,
            }} />
          </div>
          {(exercise.annotations ?? []).map((item) => (
            <PaintItemView key={item.id} item={item} />
          ))}
        </div>
      )}

      {exercise.type === 'image_question' && !hasMulti && !hasLegacyPlacement && (
        <div className="rounded-xl overflow-hidden" style={{ maxWidth: 340, margin: '0 auto', position: 'relative' }}>
          <img src={exercise.prompt_image} alt="Soru görseli"
            style={{ width: '100%', maxHeight: 260, objectFit: 'contain', display: 'block' }} />
          {(exercise.annotations ?? []).map((item) => (
            <PaintItemView key={item.id} item={item} />
          ))}
        </div>
      )}

      {exercise.type === 'image_question' && hasLegacyPlacement && (
        <div style={{ maxWidth: 340, margin: '0 auto', position: 'relative' }}>
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
          {(exercise.annotations ?? []).map((item) => (
            <PaintItemView key={item.id} item={item} />
          ))}
        </div>
      )}

      {exercise.type === 'image_question' && hasMulti && (
        <div style={{ maxWidth: 340, margin: '0 auto', position: 'relative' }}>
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
          {(exercise.annotations ?? []).map((item) => (
            <PaintItemView key={item.id} item={item} />
          ))}
        </div>
      )}
    </>
  );
}
