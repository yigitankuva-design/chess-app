'use client';
import { ReactNode } from 'react';
import { AppNav } from '@/components/ui/AppNav';
import { PresenceProvider } from '@/lib/presence/PresenceContext';

export default function ChildLayout({ children }: { children: ReactNode }) {
  // Provider BURADA: bu layout tum sporcu sayfalarini kapsar (home, play,
  // lesson, pratik, ...) — "uygulamada olan herkes" tanimi tam olarak budur.
  return (
    <PresenceProvider>
      <div className="t-page min-h-screen">
        <AppNav />
        {children}
      </div>
    </PresenceProvider>
  );
}
