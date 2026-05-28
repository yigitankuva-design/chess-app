'use client';
import { use, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LiveGame } from '@/components/LiveGame';

function LiveGameContent({ gameId }: { gameId: string }) {
  const sp = useSearchParams();
  const color = (sp.get('color') === 'black' ? 'black' : 'white') as 'white' | 'black';
  return <LiveGame gameId={Number(gameId)} myColor={color} />;
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
