'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { XPBar } from '@/components/XPBar';
import { AvatarSelector } from '@/components/AvatarSelector';
import { ChessThemeSelector } from '@/components/ChessThemeSelector';
import { getToken, getAthleteName } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth-context';
import { getSavedAvatar, saveAvatar, avatarEmoji } from '@/lib/avatars';

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
  const router = useRouter();
  const auth = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarId, setAvatarId] = useState('lion');
  const [athleteName, setAthleteName] = useState<string | null>(null);

  useEffect(() => {
    setAthleteName(getAthleteName());
  }, []);

  function handleLogout() {
    auth.logout();
    router.replace('/');
  }

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/gamification/me`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { setMe(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    setAvatarId(getSavedAvatar());
  }, []);

  if (loading) {
    return (
      <main className="px-4 pt-5 pb-12 max-w-xl mx-auto space-y-4">
        <div className="t-skel h-32 rounded-2xl" />
        <div className="t-skel h-24 rounded-2xl" />
        <div className="t-skel h-48 rounded-2xl" />
      </main>
    );
  }

  if (!me) {
    return (
      <main className="px-4 pt-8 pb-12 max-w-xl mx-auto text-center space-y-4">
        <p className="t-muted">Profil yüklenemedi. Giriş yaptın mı?</p>
        <button onClick={handleLogout} className="t-btn-ghost py-2 px-4 text-sm">
          Çıkış Yap
        </button>
      </main>
    );
  }

  return (
    <main className="px-4 pt-5 pb-12 max-w-xl mx-auto space-y-4">

      {/* Stats card */}
      <div className="t-card p-5 space-y-4">
        <div className="text-center space-y-1">
          <div className="text-5xl mb-2">{avatarEmoji(avatarId)}</div>
          {athleteName && <p className="text-lg font-bold">{athleteName}</p>}
          <p className="text-sm t-muted">{me.rank_name}</p>
          <p className="text-sm t-muted">🏆 {me.badges_earned} / {me.badges_total} rozet</p>
        </div>
        <XPBar
          currentXP={me.xp_total}
          rankName={me.rank_name}
          nextRankXP={me.next_rank_xp}
        />
      </div>

      {/* Avatar selector */}
      <div className="t-card p-5">
        <p className="text-xs font-semibold t-muted uppercase tracking-widest mb-3">
          Avatarını seç
        </p>
        <AvatarSelector
          value={avatarId}
          onChange={(id) => {
            setAvatarId(id);
            saveAvatar(id);
          }}
        />
      </div>

      {/* Theme selector */}
      <div className="t-card p-5">
        <ChessThemeSelector />
      </div>

      {/* Çıkış */}
      <button onClick={handleLogout} className="w-full t-btn-ghost py-3 text-sm">
        Çıkış Yap
      </button>

    </main>
  );
}
