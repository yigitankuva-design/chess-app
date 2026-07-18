'use client';
import { useState } from 'react';
import { Chessboard } from 'react-chessboard';

/** "yenitahta.jpeg" referansına uygun kalın-kontur taş seti. */
const PIECE_GLYPH: Record<string, string> = {
  K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

function pieceSvg(code: string) {
  const isWhite = code === code.toUpperCase();
  const glyph = PIECE_GLYPH[code];
  return (props?: { svgStyle?: React.CSSProperties }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <text
        x="22.5"
        y="35"
        textAnchor="middle"
        fontSize="36"
        fontFamily="'Segoe UI Symbol', 'Noto Sans Symbols2', 'DejaVu Sans', sans-serif"
        fill={isWhite ? '#ffffff' : '#1a1a1a'}
        stroke={isWhite ? '#1a1a1a' : '#ffffff'}
        strokeWidth={isWhite ? 2.2 : 1.4}
        paintOrder="stroke"
        strokeLinejoin="round"
      >
        {glyph}
      </text>
    </svg>
  );
}

const CUSTOM_PIECES = {
  wP: pieceSvg('P'), wN: pieceSvg('N'), wB: pieceSvg('B'), wR: pieceSvg('R'), wQ: pieceSvg('Q'), wK: pieceSvg('K'),
  bP: pieceSvg('p'), bN: pieceSvg('n'), bB: pieceSvg('b'), bR: pieceSvg('r'), bQ: pieceSvg('q'), bK: pieceSvg('k'),
};

const DARK_SQUARE_STYLE: React.CSSProperties = {
  backgroundColor: '#dcdcdc',
  backgroundImage:
    'repeating-linear-gradient(45deg, rgba(255,255,255,0.85) 0px, rgba(255,255,255,0.85) 2px, transparent 2px, transparent 7px)',
};

const LIGHT_SQUARE_STYLE: React.CSSProperties = { backgroundColor: '#ffffff' };

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const PALETTE: { code: string; label: string }[] = [
  { code: 'K', label: '♔ Şah' }, { code: 'Q', label: '♕ Vezir' }, { code: 'R', label: '♖ Kale' },
  { code: 'B', label: '♗ Fil' }, { code: 'N', label: '♘ At' }, { code: 'P', label: '♙ Piyon' },
  { code: 'k', label: '♚ Şah' }, { code: 'q', label: '♛ Vezir' }, { code: 'r', label: '♜ Kale' },
  { code: 'b', label: '♝ Fil' }, { code: 'n', label: '♞ At' }, { code: 'p', label: '♟ Piyon' },
];

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
      <div
        className="rounded-2xl overflow-hidden p-3"
        style={{ maxWidth: 360, margin: '0 auto', backgroundColor: '#d4d4d4' }}
      >
        <Chessboard
          options={{
            position: fen,
            allowDragging: false,
            onSquareClick: ({ square }) => handleSquareClick(square as string),
            pieces: CUSTOM_PIECES,
            darkSquareStyle: DARK_SQUARE_STYLE,
            lightSquareStyle: LIGHT_SQUARE_STYLE,
            boardStyle: { borderRadius: '14px', overflow: 'hidden' },
          }}
        />
      </div>

      <div>
        <p className="text-xs n-muted mb-1">Beyaz taşlar</p>
        <div className="flex flex-wrap gap-1">
          {PALETTE.slice(0, 6).map((p) => (
            <button key={p.code} type="button" onClick={() => setSelected(p.code)}
              className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                selected === p.code ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{p.label}</button>
          ))}
        </div>
        <p className="text-xs n-muted mt-2 mb-1">Siyah taşlar</p>
        <div className="flex flex-wrap gap-1">
          {PALETTE.slice(6).map((p) => (
            <button key={p.code} type="button" onClick={() => setSelected(p.code)}
              className={`px-2 py-1 rounded-md text-xs border transition-colors ${
                selected === p.code ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}>{p.label}</button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setSelected(null)}
          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
            selected === null ? 'border-rose-400 bg-rose-400/15 text-rose-200' : 'border-white/15 text-white/70 hover:bg-white/5'
          }`}>🧹 Silgi</button>
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
