'use client';
import { useMemo } from 'react';
import { Chessboard, ChessboardProvider } from 'react-chessboard';
import {
  BOARD_CARD_BG, BOARD_LABEL_COLOR, BOARD_STYLE, coordLabels,
  getBoardColors, getPieceSet,
} from '@/lib/chess/boardSkin';
import { useSettings } from '@/lib/settings/settings-context';
import { recorderState, tryAppendMove, notationRows } from '@/lib/chess/moveRecorder';

const { ranks: REC_RANKS, files: REC_FILES } = coordLabels('white');

interface Props {
  /** Konumu Kaydet anındaki başlangıç pozisyonu. */
  fen: string;
  /** Şu ana kadar kaydedilen SAN hamleleri. */
  moves: string[];
  onMovesChange: (moves: string[]) => void;
}

/**
 * NOT: Uygulamanın `ChessBoard` sarmalayıcısı burada KULLANILMAZ — şahsız
 * pozisyonlarda tıkla-oynat sessizce çalışmıyor (ölçüldü: onPieceDrop 0 kez
 * çağrıldı). Bu yüzden `BoardEditor` ile aynı desen: ham ChessboardProvider.
 */
export function MoveRecorderBoard({ fen, moves, onMovesChange }: Props) {
  const { settings } = useSettings();
  const boardColors = getBoardColors(settings.board);
  const pieceSet = useMemo(() => getPieceSet(settings.board.pieces), [settings.board.pieces]);

  const state = useMemo(() => recorderState(fen, moves), [fen, moves]);
  const rows = useMemo(() => notationRows(fen, moves), [fen, moves]);
  const sideLabel = state.turn === 'w' ? 'beyazda' : 'siyahta';

  function handleDrop({ sourceSquare, targetSquare }: {
    piece: { isSparePiece: boolean; pieceType: string };
    sourceSquare: string;
    targetSquare: string | null;
  }): boolean {
    if (!targetSquare) return false;
    const next = tryAppendMove(fen, moves, sourceSquare, targetSquare);
    if (!next) return false;
    onMovesChange(next);
    return true;
  }

  return (
    <ChessboardProvider
      options={{
        id: 'move-recorder',
        position: state.fen,
        allowDragging: true,
        pieces: pieceSet,
        lightSquareStyle: { backgroundColor: boardColors.light },
        darkSquareStyle: { backgroundColor: boardColors.dark },
        boardStyle: BOARD_STYLE,
        showNotation: false,
        onPieceDrop: handleDrop,
      }}
    >
      <div className="flex items-start gap-3 flex-wrap">
        {/* Tahta */}
        <div className="rounded-2xl p-3" style={{ backgroundColor: BOARD_CARD_BG, width: 300 }}>
          <div className="flex">
            <div className="grid shrink-0" style={{ gridTemplateRows: 'repeat(8, 1fr)', width: 18 }}>
              {REC_RANKS.map((r) => (
                <span key={r} className="flex items-center justify-center text-xs font-semibold select-none"
                  style={{ color: BOARD_LABEL_COLOR }}>{r}</span>
              ))}
            </div>
            <div className="flex-1"><Chessboard /></div>
          </div>
          <div className="flex" style={{ paddingLeft: 18 }}>
            {REC_FILES.map((f) => (
              <span key={f} className="flex-1 text-center text-xs font-semibold select-none"
                style={{ color: BOARD_LABEL_COLOR }}>{f}</span>
            ))}
          </div>
        </div>

        {/* Notasyon Tablosu */}
        <div className="flex-1 space-y-2" style={{ minWidth: 190 }}>
          <p className="text-xs n-muted">Notasyon Tablosu</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="n-muted">
                <th className="text-left py-1" style={{ width: 32 }}>#</th>
                <th className="text-left py-1">Beyaz</th>
                <th className="text-left py-1">Siyah</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-2 n-muted">
                    Henüz hamle yok — tahtada taşı sürükleyin.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.no} className="border-t border-white/10">
                    <td className="py-1 n-muted">{row.no}.</td>
                    <td className="py-1 font-mono n-text">{row.white}</td>
                    <td className="py-1 font-mono n-text">{row.black}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <button type="button" disabled={moves.length === 0}
            onClick={() => onMovesChange(moves.slice(0, -1))}
            className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 disabled:opacity-40">
            Son Hamleyi Geri Al
          </button>

          {state.stuck && (
            <p className="text-xs text-amber-300">
              Sıra {sideLabel} ama oynayabileceği taş yok. Daha fazla hamle eklemek için
              &ldquo;Konumu Düzenle&rdquo; ile karşı tarafa da taş yerleştirin.
            </p>
          )}
        </div>
      </div>
    </ChessboardProvider>
  );
}
