'use client';
import { ReactNode } from 'react';
import { AppNav } from '@/components/ui/AppNav';
import { PresenceProvider } from '@/lib/presence/PresenceContext';
import { LobbyProvider } from '@/lib/lobby/LobbyContext';
import { ChallengeToast } from '@/components/play/ChallengeToast';
import { BackOverrideProvider } from '@/lib/nav/backOverride';

/**
 * Madde 2026-09-07 (Antrenör Paneli, 4): bu grup ARTIK sadece `/students/[id]`
 * gibi tek sayfalar değil, sporcunun Hızlı Erişim'iyle AYNI tasarımı
 * kullanan `/coach` panelini de kapsıyor — bu yüzden `(child)/layout.tsx`
 * ile AYNI sağlayıcılar (tek geri butonu, maç lobisi, tema) burada da
 * kuruluyor. Önceden bu grup çıplaktı (`<>{children}</>`) — eski
 * `/classes` sayfalarının kendi (düz Tailwind) tasarımı zaten nav
 * çizmiyordu; o sayfalar kaldırıldı, kalan `/students/[id]` de bu ortak
 * nav'dan faydalanıyor.
 */
export default function TeacherLayout({ children }: { children: ReactNode }) {
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
