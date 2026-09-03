'use client';
import { ReactNode } from 'react';
import { AppNav } from '@/components/ui/AppNav';
import { PresenceProvider } from '@/lib/presence/PresenceContext';
import { LobbyProvider } from '@/lib/lobby/LobbyContext';
import { ChallengeToast } from '@/components/play/ChallengeToast';
import { BackOverrideProvider } from '@/lib/nav/backOverride';

export default function ChildLayout({ children }: { children: ReactNode }) {
  // Provider'lar BURADA: bu layout tum sporcu sayfalarini kapsar (home, play,
  // lesson, pratik, ...) — "uygulamada olan herkes" tanimi tam olarak budur.
  // Lobi soketi de burada tek sefer acilir; gelen mac teklifi bu yuzden HER
  // sayfada gorunur. BackOverrideProvider AppNav (tek geri butonu) ile
  // sayfa içeriğini (children) KARDEŞ olarak sarar — bir sayfa özel geri
  // mantığını useBackOverride ile kaydedebilsin diye (madde 2026-09-04 (4)).
  return (
    <PresenceProvider>
      <LobbyProvider>
        <BackOverrideProvider>
          <div className="t-page min-h-screen">
            <AppNav />
            <ChallengeToast />
            {children}
          </div>
        </BackOverrideProvider>
      </LobbyProvider>
    </PresenceProvider>
  );
}
