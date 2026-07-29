'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { useWebSocket, wsBase } from '@/lib/hooks/use-websocket';
import { MatchCriteria } from '@/components/play/MatchCriteria';
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';

interface Tempo { base: number; increment: number; label: string }

/** Kuyruga baglanan kisim. Tempo SECILDIKTEN sonra takilir — soket ancak
 *  o zaman acilir, boylece kuyruga temposuz girilmesi imkansiz. */
function Searching({ tempo, onCancel }: { tempo: Tempo; onCancel: () => void }) {
  const router = useRouter();
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'matched' | 'timeout'>('connecting');
  const token = typeof window !== 'undefined' ? getToken() : null;
  const url = token
    ? `${wsBase()}/ws/queue?token=${encodeURIComponent(token)}`
      + `&tc_base=${tempo.base}&tc_increment=${tempo.increment}`
    : null;

  useWebSocket(url, (data: unknown) => {
    const msg = data as { type?: string; game_id?: number | string; color?: string };
    if (msg?.type === 'waiting') setStatus('waiting');
    else if (msg?.type === 'matched') {
      setStatus('matched');
      router.push(`/play/online/${msg.game_id}?color=${msg.color}`);
    } else if (msg?.type === 'timeout') setStatus('timeout');
  });

  return (
    <div className="max-w-md mx-auto p-8 text-center space-y-6">
      <div className="text-6xl animate-pulse">⏳</div>
      <h2 className="text-2xl font-bold">
        {status === 'timeout' ? 'Şu an rakip yok' : 'Arkadaş arıyoruz...'}
      </h2>
      <p className="text-sm t-muted">Tempo: {tempo.label}</p>
      {status === 'waiting' && <p className="opacity-75">Başka bir oyuncu bekleniyor...</p>}
      {status === 'timeout' && <p className="opacity-75">Daha sonra tekrar dene veya bota karşı oyna.</p>}
      <button onClick={onCancel} className="px-6 py-2 border rounded-full">Vazgeç</button>
    </div>
  );
}

export function MatchmakingScreen({ onCancel }: { onCancel: () => void }) {
  const [tempo, setTempo] = useState<Tempo | null>(null);

  if (!tempo) {
    return (
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <p className="font-semibold text-sm">🤝 Arkadaş Ara</p>
        {/* Duzey insana karsi anlamsiz; yalnizca Tempo-Sure-Renk sorulur. */}
        <MatchCriteria
          showLevel={false}
          startLabel="Rakip Ara"
          onStart={(v: MatchCriteriaValue) => setTempo(v.timeControl)}
        />
        <button onClick={onCancel} className="t-btn-ghost w-full py-2 text-sm">Vazgeç</button>
      </div>
    );
  }

  return <Searching tempo={tempo} onCancel={onCancel} />;
}
