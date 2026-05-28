'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { useWebSocket, wsBase } from '@/lib/hooks/use-websocket';

export function MatchmakingScreen({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'matched' | 'timeout'>('connecting');
  const token = typeof window !== 'undefined' ? getToken() : null;
  const url = token ? `${wsBase()}/ws/queue?token=${encodeURIComponent(token)}` : null;

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
      {status === 'waiting' && <p className="opacity-75">Başka bir oyuncu bekleniyor...</p>}
      {status === 'timeout' && <p className="opacity-75">Daha sonra tekrar dene veya bota karşı oyna.</p>}
      <button onClick={onCancel} className="px-6 py-2 border rounded-full">Vazgeç</button>
    </div>
  );
}
