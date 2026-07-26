'use client';
import { ReactNode } from 'react';
import { AppNav } from '@/components/ui/AppNav';
import { PresenceProvider } from '@/lib/presence/PresenceContext';
import { LobbyProvider } from '@/lib/lobby/LobbyContext';
import { IncomingChallengeBanner } from '@/components/play/IncomingChallengeBanner';

export default function ChildLayout({ children }: { children: ReactNode }) {
  // Provider'lar BURADA: bu layout tum sporcu sayfalarini kapsar (home, play,
  // lesson, pratik, ...) — "uygulamada olan herkes" tanimi tam olarak budur.
  // Lobi soketi de burada tek sefer acilir; gelen mac teklifi bu yuzden HER
  // sayfada gorunur.
  return (
    <PresenceProvider>
      <LobbyProvider>
        <div className="t-page min-h-screen">
          <AppNav />
          <IncomingChallengeBanner />
          {children}
        </div>
      </LobbyProvider>
    </PresenceProvider>
  );
}
