'use client';
import { useEffect, useState } from 'react';
import { PuzzleSolver } from '@/components/PuzzleSolver';
import { getToken } from '@/lib/auth-storage';

interface Daily {
  available: boolean;
  puzzle_id?: number;
  fen?: string;
  moves?: string[];
  themes?: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function DailyPage() {
  const [daily, setDaily] = useState<Daily | null>(null);
  const [loading, setLoading] = useState(true);
  const [solved, setSolved] = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/daily/puzzle`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((d) => {
        setDaily(d);
        setLoading(false);
      })
      .catch(() => {
        setDaily({ available: false });
        setLoading(false);
      });
  }, []);

  if (loading) return <main className="p-8">Yükleniyor...</main>;
  if (!daily || !daily.available) {
    return (
      <main className="p-8 text-center">
        <p className="text-lg">Bugünün bulmacası henüz hazır değil.</p>
      </main>
    );
  }

  return (
    <main>
      <h1 className="text-2xl font-bold text-center p-4">Günün Bulmacası 📅</h1>
      {solved && (
        <p className="text-center text-green-700 font-bold mb-4">
          Bugünün bulmacasını çözdün! 🎉 Yarın yenisi gelecek.
        </p>
      )}
      <PuzzleSolver
        puzzleId={daily.puzzle_id!}
        fen={daily.fen!}
        solutionMoves={daily.moves!}
        themes={daily.themes || []}
        onComplete={(success) => { if (success) setSolved(true); }}
      />
    </main>
  );
}
