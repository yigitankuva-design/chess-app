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

    void (async () => {
      await persistMove(`${from}${to}`);
      if (chess.isGameOver()) { finish(); return; }

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

  if (status === 'loading') {
    return (
      <div className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-3">
        <div className="t-skel h-5 w-40 mx-auto" />
        <div className="t-skel aspect-square max-w-sm mx-auto rounded-lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4">
      {thinking && (
        <p className="t-muted text-center text-sm mb-3 animate-pulse">
          🤖 Bot düşünüyor...
        </p>
      )}
      <ChessBoard fen={fen} interactive={status === 'playing' && !thinking} onPieceDrop={handleDrop} />
      {status === 'over' && (
        <div className="mt-4 t-ok p-4 text-center text-lg font-bold">
          {resultText}
        </div>
      )}
    </div>
  );
}
