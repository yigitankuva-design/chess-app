'use client';
import { useEffect, useState, useCallback } from 'react';
import { PuzzleSolver } from '@/components/PuzzleSolver';
import { getToken } from '@/lib/auth-storage';

interface SRSCard {
  id: number;
  item_type: string;
  item_id: number;
  due_at: string;
}

interface Puzzle {
  id: number;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function SRSPage() {
  const [cards, setCards] = useState<SRSCard[]>([]);
  const [index, setIndex] = useState(0);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);

  const getHeaders = useCallback(() => {
    const token = getToken();
    const h: Record<string, string> = {};
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/srs/due`, { headers: getHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: SRSCard[]) => {
        setCards(data.filter((c) => c.item_type === 'puzzle'));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [getHeaders]);

  useEffect(() => {
    if (cards.length === 0 || index >= cards.length) return;
    const card = cards[index];
    fetch(`${API_BASE}/puzzles/${card.item_id}`, { headers: getHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then(setPuzzle)
      .catch(() => setPuzzle(null));
  }, [cards, index, getHeaders]);

  async function review(result: 'correct' | 'wrong') {
    const card = cards[index];
    await fetch(`${API_BASE}/srs/${card.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getHeaders() },
      body: JSON.stringify({ result }),
    });
    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex(index + 1);
      setPuzzle(null);
    }
  }

  if (loading) {
    return (
      <main className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-3">
        <div className="t-skel h-6 w-1/3 mx-auto" />
        <div className="t-skel aspect-square max-w-sm mx-auto rounded-lg" />
      </main>
    );
  }

  if (done) {
    return (
      <main className="px-4 pt-12 pb-12 max-w-2xl mx-auto text-center space-y-3">
        <div className="text-5xl">🎉</div>
        <p className="font-bold text-lg">Bugünlük tekrar bitti!</p>
        <p className="t-muted text-sm">Harika iş! Yarın yeni kartlar seni bekleyecek.</p>
      </main>
    );
  }

  if (cards.length === 0) {
    return (
      <main className="px-4 pt-12 pb-12 max-w-2xl mx-auto text-center space-y-2">
        <div className="text-4xl">👍</div>
        <p className="font-semibold">Bugün tekrar edilecek bir şey yok.</p>
        <p className="t-muted text-sm">Ders çözüp puzzle yaptıkça burası dolar.</p>
      </main>
    );
  }

  if (!puzzle) {
    return (
      <main className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-3">
        <div className="t-skel h-6 w-1/3 mx-auto" />
        <div className="t-skel aspect-square max-w-sm mx-auto rounded-lg" />
      </main>
    );
  }

  return (
    <main className="pb-12">
      <div className="px-4 pt-3 pb-1 max-w-2xl mx-auto flex items-center justify-between">
        <p className="text-xs font-semibold t-muted uppercase tracking-widest">Tekrar 🔁</p>
        <p className="text-xs font-semibold t-muted">{index + 1} / {cards.length}</p>
      </div>
      <div className="t-prog-track mx-4 mb-3 max-w-2xl" style={{ maxWidth: '42rem' }}>
        <div
          className="t-prog-fill transition-all"
          style={{ width: `${((index + 1) / cards.length) * 100}%` }}
        />
      </div>
      <PuzzleSolver
        key={puzzle.id}
        puzzleId={puzzle.id}
        fen={puzzle.fen}
        solutionMoves={puzzle.moves}
        themes={puzzle.themes}
        onComplete={(success) => setTimeout(() => review(success ? 'correct' : 'wrong'), 1500)}
      />
    </main>
  );
}
