'use client';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';

interface Badge {
  slug: string;
  name_tr: string;
  description_tr: string;
  icon: string;
  earned: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function BadgesPage() {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/gamification/badges`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        setBadges(Array.isArray(d) ? d : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <main className="p-6">Yükleniyor...</main>;

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">Rozetlerim 🏆</h1>
      <p className="opacity-75 mb-6">
        {earnedCount} / {badges.length} rozet kazanıldı
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {badges.map((b) => (
          <div
            key={b.slug}
            className={`p-4 rounded-2xl text-center border transition ${
              b.earned
                ? 'bg-yellow-50 border-yellow-300'
                : 'bg-gray-100 border-gray-200 opacity-50'
            }`}
          >
            <div className="text-4xl mb-2">{b.earned ? '🏆' : '🔒'}</div>
            <p className="font-bold text-sm">{b.name_tr}</p>
            <p className="text-xs opacity-75 mt-1">{b.description_tr}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
