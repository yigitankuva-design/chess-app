'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ComingSoon } from '@/components/ComingSoon';
import { useTabGuard } from '@/lib/settings/useTabGuard';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface FunActivity { id: number; name: string; description: string; emoji: string }

/** Madde 2026-08-21: Eğlence kartları artık admin'in eklediği veri —
 *  sabit slug haritası kaldırıldı, /fun-activities'ten id ile bulunur.
 *  Gerçek oyun mekaniği henüz yok — admin'in girdiği isim/açıklamayla
 *  "hazırlanıyor" ekranı gösterilir. */
export default function EglenceGamePage() {
  useTabGuard('eglence');
  const params = useParams();
  const id = Number(params.game);
  const [activity, setActivity] = useState<FunActivity | null | undefined>(undefined);

  useEffect(() => {
    if (!id) { setActivity(null); return; }
    fetch(`${API_BASE}/fun-activities`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: FunActivity[]) => {
        setActivity(Array.isArray(list) ? list.find((a) => a.id === id) ?? null : null);
      })
      .catch(() => setActivity(null));
  }, [id]);

  if (activity === undefined) {
    return <ComingSoon emoji="🎉" title="Eğlence" description="Yükleniyor..." />;
  }
  const a = activity ?? { emoji: '🎉', name: 'Eğlence', description: 'Bu içerik hazırlanıyor.' };
  return (
    <ComingSoon
      emoji={a.emoji}
      title={a.name}
      description={a.description || 'Bu içerik hazırlanıyor.'}
    />
  );
}
