'use client';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useLobby } from '@/lib/hooks/use-lobby';

type LobbyValue = ReturnType<typeof useLobby>;

const LobbyContext = createContext<LobbyValue | null>(null);

export function useLobbyContext(): LobbyValue {
  const v = useContext(LobbyContext);
  if (!v) throw new Error('useLobbyContext yalnizca LobbyProvider icinde kullanilir');
  return v;
}

/** Lobi soketi TEK bir yerde acilir.
 *
 *  Ikinci bir baglanti acmak YASAK: sunucudaki join_lobby ayni cocugun eski
 *  kaydinin uzerine yazar (tek sekme kurali, lobby.py) — yani ikinci baglanti
 *  ilkini dusurur ve teklif panosu olur.
 *
 *  Mac yonlendirmesi de burada: teklif nerede kabul edilirse edilsin sporcu
 *  tahtaya gider. */
export function LobbyProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const lobby = useLobby({
    onMatched: ({ gameId, color }) => router.push(`/play/online/${gameId}?color=${color}`),
  });
  return <LobbyContext.Provider value={lobby}>{children}</LobbyContext.Provider>;
}
