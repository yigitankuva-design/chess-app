'use client';
import { useState } from 'react';
import { getToken } from '@/lib/auth-storage';
import { useWebSocket, wsBase } from '@/lib/hooks/use-websocket';
import type { LobbyOffer } from '@/lib/play/offers';
import type { ColorChoice } from '@/lib/play/color';

export interface OnlinePlayer { child_id: number; display_name: string }

export interface IncomingChallenge {
  from_child_id: number;
  from_name: string;
  criteria: Record<string, unknown>;
}

export interface MatchedInfo { gameId: number; color: 'white' | 'black' }

/** Yeni teklif olustururken gonderilen alanlar (Tempo-Sure-Renk yeterli). */
export interface NewOffer {
  tempo: string;
  tc_label: string;
  tc_base: number;
  tc_increment: number;
  color: ColorChoice;
}

interface Options {
  onMatched: (info: MatchedInfo) => void;
}

/** /ws/lobby baglantisi: teklif panosu + aktif sporcu listesi + dogrudan davetler. */
export function useLobby({ onMatched }: Options) {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [offers, setOffers] = useState<LobbyOffer[]>([]);
  /** Sporcunun KENDI teklifi — panoda kendisine gosterilmez, ayri alanda gelir. */
  const [myOffer, setMyOffer] = useState<LobbyOffer | null>(null);
  const [incoming, setIncoming] = useState<IncomingChallenge | null>(null);
  const [notice, setNotice] = useState<string>('');

  const token = typeof window !== 'undefined' ? getToken() : null;
  const url = token ? `${wsBase()}/ws/lobby?token=${encodeURIComponent(token)}` : null;

  const { send } = useWebSocket(url, (data: unknown) => {
    const msg = data as {
      type?: string;
      players?: OnlinePlayer[];
      offers?: LobbyOffer[];
      my_offer?: LobbyOffer | null;
      from_child_id?: number;
      from_name?: string;
      criteria?: Record<string, unknown>;
      game_id?: number;
      color?: string;
    };
    const t = msg?.type;
    if (t === 'lobby_joined') {
      setPlayers(msg.players ?? []);
      setOffers(msg.offers ?? []);
      setMyOffer(msg.my_offer ?? null);
    } else if (t === 'offers') {
      setOffers(msg.offers ?? []);
      setMyOffer(msg.my_offer ?? null);
    } else if (t === 'offer_gone') {
      setNotice('Bu teklif alındı. Başka bir teklif seç.');
    } else if (t === 'challenge_received') {
      setIncoming({
        from_child_id: msg.from_child_id ?? 0,
        from_name: msg.from_name ?? 'Sporcu',
        criteria: msg.criteria ?? {},
      });
    } else if (t === 'challenge_declined') {
      setNotice('Teklifin reddedildi.');
    } else if (t === 'matched' && typeof msg.game_id === 'number') {
      onMatched({ gameId: msg.game_id, color: msg.color === 'black' ? 'black' : 'white' });
    }
  });

  return {
    players,
    offers,
    myOffer,
    incoming,
    notice,
    /** Panoya kendi teklifini birak (eskisi varsa uzerine yazilir). */
    createOffer: (o: NewOffer) => {
      setNotice('');
      send({ type: 'offer_create', ...o });
    },
    /** Kendi teklifini panodan kaldir. */
    cancelOffer: () => send({ type: 'offer_cancel' }),
    /** Panodaki bir teklifi al — basarili olursa 'matched' gelir. */
    takeOffer: (ownerChildId: number) => {
      setNotice('');
      send({ type: 'offer_take', child_id: ownerChildId });
    },
    /** Belirli bir sporcuya davet gonder (dogrudan davet — 4. alt proje kullanir). */
    challenge: (targetChildId: number, criteria: Record<string, unknown>) =>
      send({ type: 'challenge', target_child_id: targetChildId, criteria }),
    acceptChallenge: (c: IncomingChallenge) => {
      send({ type: 'challenge_accept', from_child_id: c.from_child_id, criteria: c.criteria });
      setIncoming(null);
    },
    declineChallenge: (c: IncomingChallenge) => {
      send({ type: 'challenge_decline', from_child_id: c.from_child_id });
      setIncoming(null);
    },
  };
}
