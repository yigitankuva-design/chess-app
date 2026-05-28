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
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((d) => { setDaily(d); setLoading(false); })
      .catch(() => { setDaily({ available: false }); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <main className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-3">
        <div className="t-skel h-6 w-1/2 mx-auto" />
        <div className="t-skel aspect-square max-w-sm mx-auto rounded-lg" />
      </main>
    );
  }

  if (!daily?.available) {
    return (
      <main className="px-4 pt-8 pb-12 max-w-2xl mx-auto text-center">
        <p className="t-muted">Bugünün bulmacası henüz hazır değil.</p>
      </main>
    );
  }

  return (
    <main className="pb-12">
      {solved && (
        <div className="t-ok mx-4 mt-3 p-3 text-center text-sm font-semibold">
          🎉 Bugünün bulmacasını çözdün! Yarın yenisi gelecek.
        </div>
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
