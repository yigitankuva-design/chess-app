'use client';
import { useEffect, useState } from 'react';
import { XPBar } from '@/components/XPBar';
import { AvatarSelector } from '@/components/AvatarSelector';
import { ChessThemeSelector } from '@/components/ChessThemeSelector';
import { getToken } from '@/lib/auth-storage';
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
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [avatarId, setAvatarId] = useState('lion');

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
      <main className="px-4 pt-8 pb-12 max-w-xl mx-auto text-center">
        <p className="t-muted">Profil yüklenemedi. Giriş yaptın mı?</p>
      </main>
    );
  }

  return (
    <main className="px-4 pt-5 pb-12 max-w-xl mx-auto space-y-4">

      {/* Stats card */}
      <div className="t-card p-5 space-y-4">
        <div className="text-center space-y-1">
          <div className="text-5xl mb-2">{avatarEmoji(avatarId)}</div>
          <p className="text-xl font-bold">{me.rank_name}</p>
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

    </main>
  );
}
