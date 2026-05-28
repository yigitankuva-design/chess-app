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
      if (!res.ok) {
        setError('Şu an uygun puzzle bulunamadı.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setPuzzle(data);
    } catch {
      setError('Bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPuzzle(); }, [loadPuzzle]);

  if (loading) return <main className="p-8">Yükleniyor...</main>;
  if (error) return <main className="p-8 text-center"><p className="text-lg">{error}</p></main>;
  if (!puzzle) return <main className="p-8">Puzzle yok.</main>;

  return (
    <main>
      <h1 className="text-2xl font-bold text-center p-4">Bulmaca 🧩</h1>
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
