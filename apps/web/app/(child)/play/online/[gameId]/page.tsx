'use client';
import { use, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LiveGame } from '@/components/LiveGame';

function LiveGameContent({ gameId }: { gameId: string }) {
  const sp = useSearchParams();
  const color = (sp.get('color') === 'black' ? 'black' : 'white') as 'white' | 'black';
  // Madde 2026-09-09 (2/3): turnuva maçından gelindiyse tournamentId taşınır —
  // LiveGame bunu görünce "Turnuvaya Geri Dön" davranışına geçer.
  const tRaw = sp.get('tournamentId');
  const tournamentId = tRaw ? Number(tRaw) : undefined;
  // Madde 2026-09-10: Berserk SADECE arena + Yıldırım/Hızlı + açıkken.
  const berserkAvailable = sp.get('berserk') === '1';
  return (
    <LiveGame gameId={Number(gameId)} myColor={color} tournamentId={tournamentId}
      berserkAvailable={berserkAvailable} />
  );
}

export default function OnlineGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  return (
    <main>
      <h1 className="text-xl font-bold text-center p-4">Canlı Oyun</h1>
      <Suspense fallback={<div className="text-center p-8">Yükleniyor...</div>}>
        <LiveGameContent gameId={gameId} />
      </Suspense>
    </main>
  );
}
