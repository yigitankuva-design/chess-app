'use client';
import { useState } from 'react';
import { Chessboard } from 'react-chessboard';
import {
  CHESS_PIECE_SET, BOARD_LIGHT_SQUARE, BOARD_DARK_SQUARE, BOARD_CARD_BG,
  BOARD_LABEL_COLOR, BOARD_STYLE, coordLabels,
} from '@/lib/chess/boardSkin';

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
  const [selected, setSelected] = useState<string | null>('P');

  function handleSquareClick(square: string) {
    const map = fenToMap(fen);
    if (selected === null) {
      delete map[square];
    } else {
      map[square] = selected;
    }
    onChange(mapToFen(map, turn));
  }

  function setTurn(t: 'w' | 'b') {
    onTurnChange(t);
    onChange(mapToFen(fenToMap(fen), t));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2" style={{ maxWidth: 440, margin: '0 auto' }}>
        {/* Sol taş paleti — tıkla, sonra kareye bas */}
        <div className="flex flex-col gap-1 shrink-0">
          <div
            className="grid gap-1"
            style={{ gridTemplateRows: 'repeat(6, 1fr)', gridAutoFlow: 'column' }}
            aria-label="Taş paleti"
          >
            {PALETTE.map((p) => {
              const Icon = CHESS_PIECE_SET[pieceKey(p.code)];
              const active = selected === p.code;
              return (
                <button
                  key={p.code}
                  type="button"
                  title={p.label}
                  aria-label={p.label}
                  onClick={() => setSelected(p.code)}
                  className={`w-9 h-9 rounded-md p-0.5 border transition-all ${
                    active ? 'border-cyan-400 ring-2 ring-cyan-400/50' : 'border-black/10 hover:border-cyan-400/60'
                  }`}
                  style={{ backgroundColor: BOARD_LIGHT_SQUARE }}
                >
                  <Icon />
                </button>
              );
            })}
          </div>
          {/* Silgi — paletin altında, tam genişlik */}
          <button
            type="button"
            title="Silgi (taş kaldır)"
            aria-label="Silgi"
            onClick={() => setSelected(null)}
            className={`h-9 w-full rounded-md border text-base transition-all ${
              selected === null ? 'border-rose-400 ring-2 ring-rose-400/50 bg-rose-400/15 text-rose-200' : 'border-white/15 text-white/70 hover:border-rose-400/60'
            }`}
          >
            🧹
          </button>
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
              <Chessboard
                options={{
                  position: fen,
                  allowDragging: false,
                  onSquareClick: ({ square }) => handleSquareClick(square as string),
                  pieces: CHESS_PIECE_SET,
                  lightSquareStyle: { backgroundColor: BOARD_LIGHT_SQUARE },
                  darkSquareStyle: { backgroundColor: BOARD_DARK_SQUARE },
                  boardStyle: BOARD_STYLE,
                  showNotation: false,
                }}
              />
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
  );
}

export { START_FEN, EMPTY_FEN };
