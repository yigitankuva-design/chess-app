'use client';
import { useEffect, useState, useCallback } from 'react';
import { PuzzleSolver } from '@/components/PuzzleSolver';
import { getToken } from '@/lib/auth-storage';

interface Puzzle {
  id: number;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function PuzzlePage() {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPuzzle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/puzzles/random`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401 || res.status === 403) {
        setError('Puzzle çözmek için giriş yapmalısın.');
        setLoading(false);
        return;
      }
      if (!res.ok) { setError('Uygun bulmaca bulunamadı.'); setLoading(false); return; }
      setPuzzle(await res.json());
    } catch {
      setError('Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPuzzle(); }, [loadPuzzle]);

  if (loading) {
    return (
      <main className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-3">
        <div className="t-skel h-6 w-1/2 mx-auto" />
        <div className="t-skel aspect-square max-w-sm mx-auto rounded-lg" />
      </main>
    );
  }

  if (error) {
    return (
      <main className="px-4 pt-8 pb-12 max-w-2xl mx-auto text-center space-y-4">
        <p className="t-err p-4">{error}</p>
        <button onClick={loadPuzzle} className="t-btn">Tekrar Dene</button>
      </main>
    );
  }

  if (!puzzle) return null;

  return (
    <main className="pb-12">
      <PuzzleSolver
        key={puzzle.id}
        puzzleId={puzzle.id}
        fen={puzzle.fen}
        solutionMoves={puzzle.moves}
        themes={puzzle.themes}
        onComplete={() => setTimeout(loadPuzzle, 1800)}
      />
    </main>
  );
}
