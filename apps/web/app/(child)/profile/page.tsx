'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { XPBar } from '@/components/XPBar';
import { getToken, getAthleteName } from '@/lib/auth-storage';
import { useAuth } from '@/lib/auth-context';
import { getSavedAvatar, avatarEmoji } from '@/lib/avatars';
import { PowerButton } from '@/components/PowerButton';

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
        <div className="flex justify-center">
          <PowerButton onClick={handleLogout} />
        </div>
      </main>
    );
  }

  return (
    <main className="px-4 pt-5 pb-12 max-w-xl mx-auto space-y-4">

      {/* Madde 2026-09-XX: "Sporcu Profili" yeniden tasarlanıyor — Rozet
          Bilgisi, Avatar Seçimi ve Tahta Seçimi kartları Zafer'in kararıyla
          kaldırıldı (bkz. Turnuva Uygulama Mimarisi tarzı araştırma/rapor
          süreci). Kimlik başlığı (avatar görüntüsü + isim + rütbe + XP)
          şimdilik kalıyor, tasarım buradan devam edecek. */}
      <div className="t-card p-5 space-y-4">
        <div className="text-center space-y-1">
          <div className="text-5xl mb-2">{avatarEmoji(avatarId)}</div>
          {athleteName && <p className="text-lg font-bold">{athleteName}</p>}
          <p className="text-sm t-muted">{me.rank_name}</p>
        </div>
        <XPBar
          currentXP={me.xp_total}
          rankName={me.rank_name}
          nextRankXP={me.next_rank_xp}
        />
      </div>

      {/* Ana sayfa + Çıkış (power ikonu) */}
      <button onClick={() => router.push('/home')} className="w-full t-btn py-3 text-base">
        Ana Sayfaya Dön
      </button>
      <div className="flex justify-center pt-1">
        <PowerButton onClick={handleLogout} />
      </div>

    </main>
  );
}
