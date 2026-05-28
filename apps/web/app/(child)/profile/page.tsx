'use client';
import { useEffect, useState } from 'react';
import { XPBar } from '@/components/XPBar';
import { getToken } from '@/lib/auth-storage';

interface Me {
  rank_name: string;
  rank_icon: string;
  xp_total: number;
  next_rank_xp: number;
  badges_earned: number;
  badges_total: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/gamification/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        setMe(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <main className="p-6">Yükleniyor...</main>;
  if (!me)
    return (
      <main className="p-6">Profil yüklenemedi. Giriş yaptın mı?</main>
    );

  return (
    <main className="p-6 max-w-xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Profilim</h1>
      <div className="p-6 bg-white rounded-2xl shadow space-y-4">
        <div className="text-center">
          <div className="text-5xl mb-2">♟️</div>
          <p className="text-2xl font-bold">{me.rank_name}</p>
        </div>
        <XPBar
          currentXP={me.xp_total}
          rankName={me.rank_name}
          nextRankXP={me.next_rank_xp}
        />
        <p className="text-center opacity-75">
          🏆 {me.badges_earned} / {me.badges_total} rozet
        </p>
      </div>
    </main>
  );
}
