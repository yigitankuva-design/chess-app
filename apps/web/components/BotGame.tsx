'use client';
import { useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { ChessBoard } from './ChessBoard';
import { StockfishEngine } from '@/lib/chess/stockfish';
import { getToken } from '@/lib/auth-storage';

interface Props {
  skillLevel: number;
  depth: number;
  onGameEnd: (result: 'win' | 'loss' | 'draw') => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function BotGame({ skillLevel, depth, onGameEnd }: Props) {
  const chessRef = useRef(new Chess());
  const engineRef = useRef<StockfishEngine | null>(null);
  const gameIdRef = useRef<number | null>(null);
  const [fen, setFen] = useState(chessRef.current.fen());
  const [thinking, setThinking] = useState(false);
  const [status, setStatus] = useState<'loading' | 'playing' | 'over'>('loading');
  const [resultText, setResultText] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const eng = new StockfishEngine();
      await eng.init();
      eng.setSkill(skillLevel);
      engineRef.current = eng;

      try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/games/bot/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ skill_level: skillLevel }),
        });
        if (res.ok) {
          const data = await res.json();
          gameIdRef.current = data.game_id;
        }
      } catch { /* offline OK — bot still works locally */ }

      if (!cancelled) setStatus('playing');
    })();
    return () => {
      cancelled = true;
      engineRef.current?.destroy();
    };
  }, [skillLevel]);

  async function persistMove(uci: string) {
    const gid = gameIdRef.current;
    if (!gid) return;
    try {
      const token = getToken();
      await fetch(`${API_BASE}/games/${gid}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ move_uci: uci }),
      });
    } catch { /* ignore */ }
  }

  function finish() {
    const chess = chessRef.current;
    setStatus('over');
    if (chess.isCheckmate()) {
      // side to move is checkmated; if it's black's turn, white (child) won
      const childWon = chess.turn() === 'b';
      setResultText(childWon ? '🎉 Kazandın! Mat!' : '😔 Bot kazandı.');
      onGameEnd(childWon ? 'win' : 'loss');
    } else {
      setResultText('🤝 Berabere.');
      onGameEnd('draw');
    }
  }

  function handleDrop(from: Square, to: Square): boolean {
    if (thinking || status !== 'playing') return false;
    const chess = chessRef.current;
    let move;
    try {
      move = chess.move({ from, to, promotion: 'q' });
    } catch {
      return false;
    }
    if (!move) return false;
    setFen(chess.fen());

    // Fire-and-forget async work after confirming the move is valid
    void (async () => {
      await persistMove(`${from}${to}`);
      if (chess.isGameOver()) { finish(); return; }

      // Bot replies
      setThinking(true);
      const botUci = await engineRef.current!.bestMove(chess.fen(), depth);
      if (botUci && botUci !== '(none)') {
        try {
          chess.move({ from: botUci.slice(0, 2) as Square, to: botUci.slice(2, 4) as Square, promotion: 'q' });
          setFen(chess.fen());
          await persistMove(botUci);
        } catch { /* ignore */ }
      }
      setThinking(false);
      if (chess.isGameOver()) finish();
    })();

    return true;
  }

  if (status === 'loading') return <div className="p-8 text-center">Bot hazırlanıyor... 🤖</div>;

  return (
    <div className="space-y-4 max-w-2xl mx-auto p-4">
      {thinking && <p className="text-blue-600 text-center">Bot düşünüyor... 🤔</p>}
      <ChessBoard fen={fen} interactive={status === 'playing' && !thinking} onPieceDrop={handleDrop} />
      {status === 'over' && (
        <div className="p-4 bg-blue-100 rounded-lg text-center text-xl font-bold">{resultText}</div>
      )}
    </div>
  );
}
