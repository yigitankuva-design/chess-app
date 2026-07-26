'use client';
import { useState } from 'react';
import { getToken } from '@/lib/auth-storage';
import { useWebSocket, wsBase } from '@/lib/hooks/use-websocket';

export interface OnlinePlayer { child_id: number; display_name: string }

export interface IncomingChallenge {
  from_child_id: number;
  from_name: string;
  criteria: Record<string, unknown>;
}

export interface MatchedInfo { gameId: number; color: 'white' | 'black' }

interface Options {
  onMatched: (info: MatchedInfo) => void;
}

/** /ws/lobby baglantisi: aktif sporcu listesi + gelen/giden mac davetleri. */
export function useLobby({ onMatched }: Options) {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [incoming, setIncoming] = useState<IncomingChallenge | null>(null);
  const [notice, setNotice] = useState<string>('');

  const token = typeof window !== 'undefined' ? getToken() : null;
  const url = token ? `${wsBase()}/ws/lobby?token=${encodeURIComponent(token)}` : null;

  const { send } = useWebSocket(url, (data: unknown) => {
    const msg = data as {
      type?: string;
      players?: OnlinePlayer[];
      from_child_id?: number;
      from_name?: string;
      criteria?: Record<string, unknown>;
      game_id?: number;
      color?: string;
    };
    const t = msg?.type;
    if (t === 'lobby_joined') {
      setPlayers(msg.players ?? []);
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
    incoming,
    notice,
    /** Belirli bir sporcuya davet gonder. */
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
