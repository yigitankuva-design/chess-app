'use client';
import { useEffect, useState } from 'react';
import { XPBar } from '@/components/XPBar';
import { AvatarSelector } from '@/components/AvatarSelector';
import { ChessThemeSelector } from '@/components/ChessThemeSelector';
import { getToken } from '@/lib/auth-storage';
import { getSavedAvatar, saveAvatar, avatarEmoji } from '@/lib/avatars';
import { useChessTheme } from '@/lib/chess-theme-context';

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
  const { themeId } = useChessTheme();

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

  useEffect(() => {
    setAvatarId(getSavedAvatar());
  }, []);

  const isDark = ['night', 'purple', 'premium', 'hologram', 'arcade'].includes(themeId);

  const cardClass = isDark
    ? 'chess-card p-6 rounded-2xl shadow-lg space-y-4'
    : 'p-6 bg-white rounded-2xl shadow space-y-4';

  const headingClass = isDark ? 'text-3xl font-bold chess-accent' : 'text-3xl font-bold';

  if (loading) return <main className="p-6">Yükleniyor...</main>;
  if (!me)
    return (
      <main className="p-6">Profil yüklenemedi. Giriş yaptın mı?</main>
    );

  return (
    <main className="p-6 max-w-xl mx-auto space-y-6">
      <h1 className={headingClass}>Profilim</h1>

      {/* Stats card */}
      <div className={cardClass}>
        <div className="text-center">
          <div className="text-5xl mb-2">{avatarEmoji(avatarId)}</div>
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

      {/* Avatar selector */}
      <div className={isDark ? 'chess-card p-6 rounded-2xl shadow-lg' : 'p-6 bg-white rounded-2xl shadow'}>
        <h2 className={`font-bold mb-3 ${isDark ? 'chess-accent' : ''}`}>
          Avatarını seç
        </h2>
        <AvatarSelector
          value={avatarId}
          onChange={(id) => {
            setAvatarId(id);
            saveAvatar(id);
          }}
        />
      </div>

      {/* Theme selector */}
      <div className={isDark ? 'chess-card p-6 rounded-2xl shadow-lg' : 'p-6 bg-white rounded-2xl shadow'}>
        <ChessThemeSelector />
      </div>
    </main>
  );
}
