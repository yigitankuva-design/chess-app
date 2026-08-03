'use client';
import { useMemo } from 'react';
import { Chessboard, ChessboardProvider, SparePiece } from 'react-chessboard';
import { BoardEditor } from '@/components/BoardEditor';
import { SavedPositionBoard } from './SavedPositionBoard';
import { PaintEditor } from './PaintEditor';
import {
  BOARD_CARD_BG, BOARD_LABEL_COLOR, BOARD_STYLE, coordLabels,
  getBoardColors, getPieceSet,
} from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';
import { PIECE_PALETTE, pieceKey, pieceLabel } from '@/lib/chess/pieceCodes';
import type { PaintItem } from '@/lib/chess/paintItems';

const { ranks: RANKS, files: FILE_LABELS } = coordLabels('white');

interface Props {
  /** Dizme aşamasındaki FEN (kaydedilmeden önce). */
  fen: string;
  turn: 'w' | 'b';
  /** "Konumu Kaydet" sonrası kilitlenen konum; null = henüz kaydedilmedi. */
  savedFen: string | null;
  /** Palette seçili, karesi henüz belirlenmemiş taş. */
  selectedPiece: string | null;
  pieces: { piece: string; square: string }[];
  /** C grubu — tahtaya eklenen serbest yazı/şekil/renk öğeleri (opsiyonel). */
  annotations: PaintItem[];
  onAnnotationsChange: (items: PaintItem[]) => void;
  onFenChange: (fen: string) => void;
  onTurnChange: (t: 'w' | 'b') => void;
  onSavePosition: () => void;
  onSelectPiece: (code: string | null) => void;
  onAddPair: (piece: string, square: string) => void;
  onRemovePair: (index: number) => void;
}

/**
 * "Taş Nerde?" sorusunun panel tarafı.
 *
 * İki faz: (1) konumu diz + kaydet — mevcut BoardEditor kullanılır;
 * (2) eksik taşları belirle — paletten taş seç, tahtada karesine tıkla.
 */
export function PlacePiecesFields({
  fen, turn, savedFen, selectedPiece, pieces, annotations, onAnnotationsChange,
  onFenChange, onTurnChange, onSavePosition, onSelectPiece, onAddPair, onRemovePair,
}: Props) {
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = useMemo(() => getPieceSet(settings.board.pieces), [settings.board.pieces]);

  if (savedFen === null) {
    return (
      <div className="space-y-3">
        <p className="text-xs n-muted text-center">
          Konumu diz — sporcunun yerleştireceği taşları KOYMA, onları sonraki adımda belirleyeceksin.
        </p>
        <BoardEditor fen={fen} turn={turn} onChange={onFenChange} onTurnChange={onTurnChange} />
        {/* Buton stili MovePieceFields.tsx:47 ile birebir aynı — panelde tek görünüm. */}
        <button type="button" onClick={onSavePosition}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-sm transition-colors">
          Konumu Kaydet
        </button>
      </div>
    );
  }

  return (
    /* SAĞLAYICI EN DIŞTA: SparePiece tahta bağlamına ihtiyaç duyuyor — palet
       sağlayıcının dışında kalırsa "allowDragging of null" hatası verir
       (BoardEditor.tsx de aynı sebeple sağlayıcıyı en dışta tutuyor). */
    <ChessboardProvider
      options={{
        id: 'place-pieces-target',
        position: savedFen,
        allowDragging: false,
        pieces: pieceSet,
        lightSquareStyle: { backgroundColor: boardColors.light },
        darkSquareStyle: { backgroundColor: boardColors.dark },
        boardStyle: BOARD_STYLE,
        showNotation: false,
        onSquareClick: ({ square }: { square: string }) => {
          if (selectedPiece) onAddPair(selectedPiece, square);
        },
      }}
    >
    <div className="space-y-3">
      <p className="text-xs n-muted text-center">
        Paletten bir taş seç, sonra tahtada o taşın gitmesi gereken kareye tıkla
      </p>

      <div className="flex items-start gap-2" style={{ maxWidth: 440 }}>
        <div
          className="grid gap-1 shrink-0"
          style={{ gridTemplateRows: 'repeat(6, 1fr)', gridAutoFlow: 'column' }}
          aria-label="Eklenecek taş paleti"
        >
          {PIECE_PALETTE.map((p) => {
            const sel = selectedPiece === p.code;
            return (
              <button
                key={p.code}
                type="button"
                aria-label={p.label}
                title={p.label}
                onClick={() => onSelectPiece(sel ? null : p.code)}
                className={`w-9 h-9 rounded-md p-0.5 border ${
                  sel ? 'ring-2 ring-cyan-400 border-cyan-400' : 'border-black/10'
                }`}
                style={{ backgroundColor: boardColors.light }}
              >
                <SparePiece pieceType={pieceKey(p.code)} />
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl p-3 flex-1 min-w-0" style={{ backgroundColor: BOARD_CARD_BG }}>
          <div className="flex">
            <div className="grid shrink-0" style={{ gridTemplateRows: 'repeat(8, 1fr)', width: 18 }}>
              {RANKS.map((r) => (
                <span key={r} className="flex items-center justify-center text-xs font-semibold select-none"
                  style={{ color: BOARD_LABEL_COLOR }}>{r}</span>
              ))}
            </div>
            <div className="aspect-square flex-1" style={BOARD_STYLE}>
              <Chessboard />
            </div>
          </div>
          <div className="flex" style={{ paddingLeft: 18 }}>
            {FILE_LABELS.map((f) => (
              <span key={f} className="flex-1 text-center text-xs font-semibold select-none"
                style={{ color: BOARD_LABEL_COLOR }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {pieces.length > 0 && (
        <ul className="space-y-1">
          {pieces.map((p, i) => (
            <li key={`${p.piece}-${p.square}-${i}`}
              className="flex items-center justify-between text-xs px-3 py-2 rounded-lg border border-white/10">
              <span>{pieceLabel(p.piece)} → {p.square}</span>
              <button type="button" onClick={() => onRemovePair(i)}
                className="text-rose-300 hover:text-rose-200" aria-label={`Sil ${p.square}`}>
                Sil
              </button>
            </li>
          ))}
        </ul>
      )}

      <PaintEditor items={annotations} onChange={onAnnotationsChange}>
        <SavedPositionBoard fen={savedFen} marked={pieces.map((p) => p.square)} />
      </PaintEditor>
    </div>
    </ChessboardProvider>
  );
}
