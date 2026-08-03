'use client';
import { useMemo, useState } from 'react';
import { Chessboard, ChessboardProvider, SparePiece } from 'react-chessboard';
import {
  BOARD_CARD_BG, BOARD_LABEL_COLOR, BOARD_STYLE, coordLabels,
  getBoardColors, getPieceSet,
} from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';
import { pieceKey, pieceLabel, pieceTypeToFen } from '@/lib/chess/pieceCodes';
import { fenToMap, mapToFen } from '@/components/BoardEditor';
import { evaluatePlacement, allPlaced } from '@/lib/play/placePieces';
import type { PiecePlacement } from '@/lib/play/placePieces';
import type { PlacePiecesEx } from './BoardExercise';
import { PaintItemView } from '@/components/PaintItemView';

const { ranks: RANKS, files: FILE_LABELS } = coordLabels('white');

interface Props {
  exercise: PlacePiecesEx;
  /** Soru cevaplanmışsa tahta etkileşimsiz olur. */
  disabled: boolean;
  onSolved: () => void;
  onWrong: (msg: string) => void;
}

/**
 * "Taş Nerde?" sorusunun sporcu tarafı.
 *
 * Kendi tahtasını HAM react-chessboard ile çizer — components/ChessBoard.tsx
 * sarmalayıcısının onPieceDrop imzası `(from, to) => boolean` olduğu için
 * tahta DIŞINDAN sürüklenen taşın "spare" olduğu bilgisini taşımıyor.
 */
export function PlacePiecesSolver({ exercise, disabled, onSolved, onWrong }: Props) {
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = useMemo(() => getPieceSet(settings.board.pieces), [settings.board.pieces]);

  /** Henüz yerleştirilmemiş taşlar — doğru konanlar buradan düşer. */
  const [pending, setPending] = useState<PiecePlacement[]>(exercise.pieces);
  /** Tıkla-tıkla için seçili kart. */
  const [selected, setSelected] = useState<string | null>(null);
  /** Tahtaya konmuş taşlarla güncellenen görüntü FEN'i. */
  const [fen, setFen] = useState(exercise.fen);
  const turn = exercise.fen.split(' ')[1] === 'b' ? 'b' : 'w';

  function place(piece: string, square: string) {
    if (disabled) return;
    const r = evaluatePlacement(pending, piece, square);
    if (!r.ok) {
      onWrong(exercise.fail_msg ?? 'Bu taşın yeri burası değil.');
      return;
    }
    const map = fenToMap(fen);
    map[square] = piece;
    setFen(mapToFen(map, turn));
    setPending(r.remaining);
    setSelected(null);
    if (allPlaced(r.remaining)) onSolved();
  }

  function handleDrop({ piece, targetSquare }: {
    piece: { isSparePiece: boolean; pieceType: string };
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    // Yalnızca DIŞARIDAN (dairesel karttan) gelen taş kabul edilir; tahtadaki
    // taşları oynatmak bu soru tipinde anlamlı değil.
    if (!targetSquare || !piece.isSparePiece) return false;
    place(pieceTypeToFen(piece.pieceType), targetSquare);
    return true;
  }

  return (
    <ChessboardProvider
      options={{
        id: 'place-pieces-solver',
        position: fen,
        allowDragging: !disabled,
        pieces: pieceSet,
        lightSquareStyle: { backgroundColor: boardColors.light },
        darkSquareStyle: { backgroundColor: boardColors.dark },
        boardStyle: BOARD_STYLE,
        showNotation: false,
        onPieceDrop: handleDrop,
        onSquareClick: ({ square }: { square: string }) => {
          if (selected) place(selected, square);
        },
      }}
    >
      <div className="space-y-2">
        <p className="text-xs text-center" style={{ color: 'var(--t-muted)' }}>
          Taşı tahtaya <b>sürükle</b> veya taşa sonra kareye <b>tıkla</b>
        </p>

        {/* Eksik taşlar — dairesel kartlar */}
        <div className="flex flex-wrap justify-center gap-2">
          {pending.map((p, i) => {
            const isSel = selected === p.piece;
            return (
              <button
                key={`${p.piece}-${p.square}-${i}`}
                type="button"
                disabled={disabled}
                aria-label={pieceLabel(p.piece)}
                title={pieceLabel(p.piece)}
                onClick={() => setSelected((prev) => (prev === p.piece ? null : p.piece))}
                className="w-12 h-12 rounded-full p-1 transition-all disabled:opacity-50"
                style={{
                  backgroundColor: boardColors.light,
                  border: isSel ? '3px solid var(--t-accent)' : '2px solid var(--t-border)',
                }}
              >
                <SparePiece pieceType={pieceKey(p.piece)} />
              </button>
            );
          })}
        </div>

        {/* Tahta — kenar etiketleriyle (diğer soru tipleriyle aynı görünüm) */}
        <div className="w-full mx-auto p-3 rounded-2xl" style={{ maxWidth: 340, backgroundColor: BOARD_CARD_BG, position: 'relative' }}>
          <div className="flex">
            <div className="grid shrink-0" style={{ gridTemplateRows: 'repeat(8, 1fr)', width: 18 }}>
              {RANKS.map((r) => (
                <span key={r} className="flex items-center justify-center font-semibold select-none"
                  style={{ fontSize: 12, color: BOARD_LABEL_COLOR }}>{r}</span>
              ))}
            </div>
            <div className="aspect-square flex-1" style={BOARD_STYLE}>
              <Chessboard />
            </div>
          </div>
          <div className="flex" style={{ paddingLeft: 18 }}>
            {FILE_LABELS.map((f) => (
              <span key={f} className="flex-1 text-center font-semibold select-none"
                style={{ fontSize: 12, color: BOARD_LABEL_COLOR }}>{f}</span>
            ))}
          </div>
          {(exercise.annotations ?? []).map((item) => (
            <PaintItemView key={item.id} item={item} />
          ))}
        </div>
      </div>
    </ChessboardProvider>
  );
}
