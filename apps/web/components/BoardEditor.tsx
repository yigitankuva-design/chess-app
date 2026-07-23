'use client';
import { Chessboard, ChessboardProvider, SparePiece } from 'react-chessboard';
import {
  CHESS_PIECE_SET, BOARD_CARD_BG,
  BOARD_LABEL_COLOR, BOARD_STYLE, coordLabels, getBoardColors, getPieceSet,
} from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';
import { useMemo, useState } from 'react';

const { ranks: EDITOR_RANKS, files: EDITOR_FILES_LABELS } = coordLabels('white');

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PALETTE: { code: string; label: string }[] = [
  { code: 'K', label: 'Beyaz Şah' }, { code: 'Q', label: 'Beyaz Vezir' }, { code: 'R', label: 'Beyaz Kale' },
  { code: 'B', label: 'Beyaz Fil' }, { code: 'N', label: 'Beyaz At' }, { code: 'P', label: 'Beyaz Piyon' },
  { code: 'k', label: 'Siyah Şah' }, { code: 'q', label: 'Siyah Vezir' }, { code: 'r', label: 'Siyah Kale' },
  { code: 'b', label: 'Siyah Fil' }, { code: 'n', label: 'Siyah At' }, { code: 'p', label: 'Siyah Piyon' },
];

/** Palet kodunu (K, p, ...) taş seti anahtarına (wK, bP, ...) çevirir. */
function pieceKey(code: string): keyof typeof CHESS_PIECE_SET {
  return `${code === code.toUpperCase() ? 'w' : 'b'}${code.toUpperCase()}` as keyof typeof CHESS_PIECE_SET;
}

/** Taş seti anahtarını (wP, bN, ...) FEN karakterine (P, n, ...) çevirir. */
function pieceTypeToFen(pieceType: string): string {
  const color = pieceType[0];
  const type = pieceType[1];
  return color === 'w' ? type.toUpperCase() : type.toLowerCase();
}

/** FEN'in taş yerleşimi kısmını kare→taş haritasına çevirir. */
export function fenToMap(fen: string): Record<string, string> {
  const placement = fen.split(' ')[0];
  const map: Record<string, string> = {};
  placement.split('/').forEach((row, rankIdx) => {
    const rank = 8 - rankIdx;
    let fileIdx = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        fileIdx += Number(ch);
      } else {
        map[`${FILES[fileIdx]}${rank}`] = ch;
        fileIdx += 1;
      }
    }
  });
  return map;
}

/** Kare→taş haritasını tam FEN'e çevirir. */
export function mapToFen(map: Record<string, string>, turn: 'w' | 'b'): string {
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = '';
    let empty = 0;
    for (const f of FILES) {
      const piece = map[`${f}${rank}`];
      if (piece) {
        if (empty > 0) { row += String(empty); empty = 0; }
        row += piece;
      } else {
        empty += 1;
      }
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }
  return `${rows.join('/')} ${turn} - - 0 1`;
}

interface Props {
  fen: string;
  turn: 'w' | 'b';
  onChange: (fen: string) => void;
  onTurnChange: (turn: 'w' | 'b') => void;
}

export function BoardEditor({ fen, turn, onChange, onTurnChange }: Props) {
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = useMemo(() => getPieceSet(settings.board.pieces), [settings.board.pieces]);

  const [selectedPaletteKey, setSelectedPaletteKey] = useState<string | null>(null);

  function togglePaletteSelection(code: string) {
    setSelectedPaletteKey((prev) => (prev === code ? null : code));
  }

  // Sürükle-bırak: paletten (spare) veya tahtadan taş bırakıldığında.
  function handleDrop({ piece, sourceSquare, targetSquare }: {
    piece: { isSparePiece: boolean; pieceType: string };
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    if (!targetSquare) return false;
    const map = fenToMap(fen);
    if (piece.isSparePiece) {
      map[targetSquare] = pieceTypeToFen(piece.pieceType);
    } else {
      // Tahtadaki taşı taşı
      delete map[sourceSquare];
      map[targetSquare] = pieceTypeToFen(piece.pieceType);
    }
    onChange(mapToFen(map, turn));
    return true;
  }

  // Seçili palet taşı varken tahtada bir kareye tıklamak o taşı oraya yerleştirir
  // (kare doluysa üzerine yazar). Seçim, palet taşına tekrar tıklanana kadar aktif kalır.
  function handleSquareClick({ square }: { piece: { pieceType: string } | null; square: string }) {
    if (!selectedPaletteKey) return;
    const map = fenToMap(fen);
    map[square] = selectedPaletteKey;
    onChange(mapToFen(map, turn));
  }

  // Tahtadaki bir taşa tıklamak onu siler — AMA seçili bir palet taşı varken değil:
  // o durumda aynı tıklama handleSquareClick tarafından "buraya yerleştir" olarak
  // yorumlanıyor, ikisi birden çalışırsa onChange iki kez tetiklenir.
  function handlePieceClick({ isSparePiece, square }: {
    isSparePiece: boolean; square: string | null;
  }) {
    if (selectedPaletteKey) return;
    if (isSparePiece || !square) return;
    const map = fenToMap(fen);
    delete map[square];
    onChange(mapToFen(map, turn));
  }

  function setTurn(t: 'w' | 'b') {
    onTurnChange(t);
    onChange(mapToFen(fenToMap(fen), t));
  }

  return (
    <ChessboardProvider
      options={{
        id: 'board-editor',
        position: fen,
        allowDragging: true,
        pieces: pieceSet,
        lightSquareStyle: { backgroundColor: boardColors.light },
        darkSquareStyle: { backgroundColor: boardColors.dark },
        boardStyle: BOARD_STYLE,
        showNotation: false,
        onPieceDrop: handleDrop,
        onPieceClick: handlePieceClick,
        onSquareClick: handleSquareClick,
      }}
    >
    <div className="space-y-3">
      <p className="text-xs n-muted text-center">
        Taşı tahtaya <b>sürükle</b> veya paletten seçip kareye <b>tıkla</b> · eklenen taşı silmek için üstüne <b>tıkla</b>
      </p>
      <div className="flex items-start gap-2" style={{ maxWidth: 440 }}>
        {/* Sol taş paleti — sürüklenebilir taşlar */}
        <div className="flex flex-col gap-1 shrink-0">
          <div
            className="grid gap-1"
            style={{ gridTemplateRows: 'repeat(6, 1fr)', gridAutoFlow: 'column' }}
            aria-label="Taş paleti"
          >
            {PALETTE.map((p) => {
              const selected = selectedPaletteKey === p.code;
              return (
                <div
                  key={p.code}
                  title={p.label}
                  aria-label={p.label}
                  onClick={() => togglePaletteSelection(p.code)}
                  className={`w-9 h-9 rounded-md p-0.5 border cursor-pointer active:cursor-grabbing ${
                    selected ? 'ring-2 ring-cyan-400 border-cyan-400' : 'border-black/10'
                  }`}
                  style={{ backgroundColor: boardColors.light }}
                >
                  <SparePiece pieceType={pieceKey(p.code)} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Tahta */}
        <div
          className="rounded-2xl p-3 flex-1 min-w-0"
          style={{ backgroundColor: BOARD_CARD_BG }}
        >
          <div className="flex">
            <div className="grid shrink-0" style={{ gridTemplateRows: 'repeat(8, 1fr)', width: 18 }}>
              {EDITOR_RANKS.map((r) => (
                <span key={r} className="flex items-center justify-center text-xs font-semibold select-none" style={{ color: BOARD_LABEL_COLOR }}>
                  {r}
                </span>
              ))}
            </div>
            <div className="flex-1">
              <Chessboard />
            </div>
          </div>
          <div className="flex" style={{ paddingLeft: 18 }}>
            {EDITOR_FILES_LABELS.map((f) => (
              <span key={f} className="flex-1 text-center text-xs font-semibold select-none" style={{ color: BOARD_LABEL_COLOR }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onChange(mapToFen(fenToMap(START_FEN), turn))}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Başlangıç konumu
        </button>
        <button type="button" onClick={() => onChange(mapToFen({}, turn))}
          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Tahtayı temizle
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs n-muted">Hamle sırası:</span>
        <button type="button" onClick={() => setTurn('w')}
          className={`px-3 py-1 rounded-lg text-xs border ${turn === 'w' ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70'}`}>Beyaz</button>
        <button type="button" onClick={() => setTurn('b')}
          className={`px-3 py-1 rounded-lg text-xs border ${turn === 'b' ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70'}`}>Siyah</button>
      </div>

      <p className="text-xs n-muted break-all">FEN: {fen}</p>
    </div>
    </ChessboardProvider>
  );
}

export { START_FEN, EMPTY_FEN };
