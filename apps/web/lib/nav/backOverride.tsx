'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type BackHandler = () => void;

interface Ctx {
  handler: BackHandler | null;
  setHandler: (fn: BackHandler | null) => void;
}

const BackOverrideContext = createContext<Ctx | null>(null);

/**
 * Madde 2026-09-04 (4): uygulamada TEK bir geri butonu var (AppNav.tsx'in
 * üst bar'ı) — ama bazı sayfaların "geri" işlemi düz bir sayfa değişikliği
 * değil, ÖZEL bir mantık gerektiriyor (örn. custom/[id]/alt-konu/[sectionId]
 * sayfasının accordion'da hangi yolun açık kaldığını sessionStorage'a
 * yazması). Bu sayfalar KENDİ butonlarını çizmek yerine `useBackOverride`
 * ile bu mantığı kaydeder; AppNav TEK butonuyla `useBackOverrideHandler`
 * üzerinden bunu okuyup çağırır — ekranda İKİNCİ bir geri göstergesi hiç
 * oluşmaz.
 */
export function BackOverrideProvider({ children }: { children: ReactNode }) {
  const [handler, setHandler] = useState<BackHandler | null>(null);
  return (
    <BackOverrideContext.Provider value={{ handler, setHandler }}>
      {children}
    </BackOverrideContext.Provider>
  );
}

/** AppNav bunu okur — dolu ise varsayılan router.back()/push YERİNE bunu çağırır. */
export function useBackOverrideHandler(): BackHandler | null {
  const ctx = useContext(BackOverrideContext);
  return ctx?.handler ?? null;
}

/** Bir sayfa özel "geri" mantığını kaydeder — unmount olunca otomatik
 *  temizlenir, sıradaki sayfa AppNav'ın varsayılan davranışına döner.
 *  `null` verilirse (ör. koşullu) override devre dışı kalır. */
export function useBackOverride(fn: BackHandler | null): void {
  const ctx = useContext(BackOverrideContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setHandler(() => fn);
    return () => ctx.setHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, fn]);
}
