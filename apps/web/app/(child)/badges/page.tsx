'use client';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';
import { useTabGuard } from '@/lib/settings/useTabGuard';

interface Badge {
  slug: string;
  name_tr: string;
  description_tr: string;
  icon: string;
  earned: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function BadgesPage() {
  useTabGuard('badges');
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/gamification/badges`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { setBadges(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <main id="main-content" className="px-4 pt-5 pb-12 max-w-2xl mx-auto">
      <div className="mb-5">
        <p className="text-xs font-semibold t-muted uppercase tracking-widest">
          {loading ? '...' : `${earnedCount} / ${badges.length} kazanıldı`}
        </p>
      </div>
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4,5,6].map((i) => <div key={i} className="t-skel h-28" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {badges.map((b) => (
            <div key={b.slug} className={`t-card p-4 text-center ${!b.earned ? 'opacity-40' : ''}`}>
              <div className="text-3xl mb-2">{b.earned ? (b.icon || '🏆') : '🔒'}</div>
              <p className="font-semibold text-sm leading-tight">{b.name_tr}</p>
              <p className="text-xs t-muted mt-1 leading-snug">{b.description_tr}</p>
              {b.earned && <span className="mt-2 inline-block t-tag-ac">Kazanıldı</span>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
