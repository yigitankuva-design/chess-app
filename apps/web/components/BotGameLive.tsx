'use client';
import { useEffect, useState } from 'react';
import { LiveGame } from './LiveGame';
import { getToken } from '@/lib/auth-storage';
import type { TimeControl } from './BotGame';
import {
  botGameLiveKey, loadBotGameLiveId, saveBotGameLiveId,
} from '@/lib/play/botGameLiveSession';

interface Props {
  skillLevel: number;
  timeControl?: TimeControl | null;
  /** Sporcunun oynadığı renk. Varsayılan 'w'. */
  studentColor?: 'w' | 'b';
  /** Açılış pratiği için başlangıç pozisyonu. Verilmezse standart başlangıç. */
  startFen?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export function BotGameLive({ skillLevel, timeControl, studentColor = 'w', startFen }: Props) {
  const sessionKey = botGameLiveKey(skillLevel, studentColor, startFen);
  const [gameId, setGameId] = useState<number | null>(() => loadBotGameLiveId(sessionKey));

  useEffect(() => {
    if (gameId != null) return; // sayfa yenilendi, kayıtlı maça bağlanılacak
    let cancelled = false;
    (async () => {
      try {
        const token = getToken();
        const res = await fetch(`${API_BASE}/games/bot/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            skill_level: skillLevel,
            student_color: studentColor,
            start_fen: startFen ?? null,
            tc_base_seconds: timeControl?.base ?? null,
            tc_increment_seconds: timeControl?.increment ?? 0,
          }),
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          saveBotGameLiveId(sessionKey, data.game_id);
          setGameId(data.game_id);
        }
      } catch { /* offline — asagida yukleniyor iskeleti kalir */ }
    })();
    return () => { cancelled = true; };
  }, [gameId, sessionKey, skillLevel, studentColor, startFen, timeControl]);

  if (gameId == null) {
    return (
      <div className="px-4 pt-5 pb-12 max-w-2xl mx-auto space-y-3">
        <div className="t-skel h-5 w-40 mx-auto" />
        <div className="t-skel aspect-square max-w-sm mx-auto rounded-lg" />
      </div>
    );
  }

  return <LiveGame gameId={gameId} myColor={studentColor === 'w' ? 'white' : 'black'} />;
}
