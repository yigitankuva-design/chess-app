'use client';
import { useState, useRef } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { getToken } from '@/lib/auth-storage';
import { useWebSocket, wsBase } from '@/lib/hooks/use-websocket';

interface Props { gameId: number; myColor: 'white' | 'black'; }

export function LiveGame({ gameId, myColor }: Props) {
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState(chessRef.current.fen());
  const [status, setStatus] = useState<'active' | 'over'>('active');
  const [info, setInfo] = useState<string>('');
  const [drawOffered, setDrawOffered] = useState(false);

  const token = typeof window !== 'undefined' ? getToken() : null;
  const url = token ? `${wsBase()}/ws/game/${gameId}?token=${encodeURIComponent(token)}` : null;

  const { send } = useWebSocket(url, (data: unknown) => {
    const msg = data as {
      type?: string;
      fen_after?: string;
      is_checkmate?: boolean;
      is_stalemate?: boolean;
      result?: string;
      by_resign?: boolean;
      by_child_id?: number | string;
    };
    const t = msg?.type;
    if (t === 'move_made') {
      const chess = chessRef.current;
      if (msg.fen_after && chess.fen() !== msg.fen_after) {
        try { chess.load(msg.fen_after); setFen(msg.fen_after); } catch { /* ignore */ }
      }
      if (msg.is_checkmate) { setStatus('over'); setInfo('Mat! Oyun bitti.'); }
      else if (msg.is_stalemate) { setStatus('over'); setInfo('Pat! Berabere.'); }
    } else if (t === 'game_over') {
      setStatus('over');
      const r = msg.result;
      const iWon = (r === '1-0' && myColor === 'white') || (r === '0-1' && myColor === 'black');
      setInfo(msg.by_resign
        ? (iWon ? 'Rakip teslim oldu, kazandın! 🎉' : 'Teslim oldun.')
        : r === '1/2-1/2' ? 'Berabere 🤝' : (iWon ? 'Kazandın! 🎉' : 'Kaybettin.'));
    } else if (t === 'opponent_disconnected') {
      setInfo('Rakip bağlantısı koptu.');
    } else if (t === 'invalid_move') {
      setFen(chessRef.current.fen());
    } else if (t === 'draw_offered') {
      setDrawOffered(true);
    }
  });

  function handleDrop(from: Square, to: Square): boolean {
    if (status !== 'active') return false;
    const chess = chessRef.current;
    const myTurn = (chess.turn() === 'w' && myColor === 'white') || (chess.turn() === 'b' && myColor === 'black');
    if (!myTurn) return false;
    let move;
    try { move = chess.move({ from, to, promotion: 'q' }); } catch { return false; }
    if (!move) return false;
    setFen(chess.fen());
    send({ type: 'move', uci: `${from}${to}` });
    if (chess.isCheckmate()) { setStatus('over'); setInfo('Mat! Kazandın! 🎉'); }
    return true;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 space-y-3">
      <ChessBoard fen={fen} interactive={status === 'active'} onPieceDrop={handleDrop} boardOrientation={myColor} />
      {drawOffered && status === 'active' && (
        <div className="t-ok p-3 flex items-center justify-between">
          <span className="text-sm">Rakip beraberlik teklif etti</span>
          <button
            onClick={() => { send({ type: 'accept_draw' }); setDrawOffered(false); }}
            className="text-xs underline font-medium"
          >
            Kabul et
          </button>
        </div>
      )}
      {status === 'over' ? (
        <div className="t-ok p-4 text-center font-bold">{info}</div>
      ) : (
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => send({ type: 'offer_draw' })}
            className="t-btn-ghost px-4 py-2 text-sm"
          >
            Beraberlik teklif et
          </button>
          <button
            onClick={() => { if (confirm('Teslim olmak istiyor musun?')) send({ type: 'resign' }); }}
            className="t-btn px-4 py-2 text-sm"
            style={{ background: 'var(--t-err-bg, #ef4444)', color: '#fff' }}
          >
            Teslim ol
          </button>
        </div>
      )}
      {info && status === 'active' && <p className="text-center text-sm t-muted">{info}</p>}
    </div>
  );
}
