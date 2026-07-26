'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { pingPresence } from '@/lib/presence/presenceApi';

/** null = bilinmiyor (henuz ping atilmadi / hata). 0 gecerli bir degerdir. */
const PresenceContext = createContext<number | null>(null);

/** Aktif DIGER sporcu sayisi. Provider disinda null doner (cokmez). */
export function usePresenceCount(): number | null {
  return useContext(PresenceContext);
}

interface Props {
  children: ReactNode;
  /**
   * Ping araligi (ms). Varsayilan 30 sn.
   * Testte kisa deger verilir — sahte zamanlayici yerine gercek kisa aralik
   * kullanilir (async fetch ile fake timer birlesimi kirilgan).
   */
  intervalMs?: number;
}

/**
 * Ping dongusu TEK YERDE calisir (sporcu layout'u). Sayi context ile dagitilir —
 * her kart kendi ping'ini atarsa gereksiz trafik olurdu.
 */
export function PresenceProvider({ children, intervalMs = 30_000 }: Props) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const beat = async () => {
      const n = await pingPresence();
      if (alive) setCount(n);
    };
    void beat();                                  // ilk ping hemen
    const id = setInterval(() => void beat(), intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [intervalMs]);

  return <PresenceContext.Provider value={count}>{children}</PresenceContext.Provider>;
}
