'use client';
import { useRouter } from 'next/navigation';
import { MatchmakingScreen } from '@/components/MatchmakingScreen';

export default function OnlineMatchmakingPage() {
  const router = useRouter();
  return (
    <main>
      <h1 className="text-2xl font-bold text-center p-4">Arkadaşla Oyna 🤝</h1>
      <MatchmakingScreen onCancel={() => router.push('/play')} />
    </main>
  );
}
