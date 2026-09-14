'use client';
import { useEffect, useRef, useState } from 'react';
import { requestGameAnalysis, fetchGameAnalysis } from '@/lib/chess/gameAnalysisApi';
import type { GameSummary } from '@/lib/chess/gameSummary';
import type { WhiteScore } from '@/lib/chess/moveQuality';

/** Motor artık backend'de (native Stockfish) çalışıyor — bu hook
 *  `useMoveQualityEval`'in (istemci WASM motoru) YERİNİ ALIR: `BotGame.tsx`
 *  ve `GameAnalysisSection.tsx`'in ORTAK ihtiyacı. Akış: mount/gameId
 *  değişince `requestGameAnalysis` (POST) TETİKLER — zaten hesaplanmışsa
 *  sonuç anında gelir; yoksa `fetchGameAnalysis` (GET) ile POLL edilir.
 *  `hatalarim/page.tsx`'teki "birkaç deneme, aralarla" polling deseninin
 *  AYNI fikri, daha uzun bir zaman aşımıyla genelleştirildi. */

const POLL_INTERVAL_MS = 1500;
const MAX_WAIT_MS = 90_000;

export type AnalysisStatus = 'idle' | 'pending' | 'done' | 'error';

interface Result {
  summary: GameSummary | null;
  evalByPly: Record<number, WhiteScore>;
  status: AnalysisStatus;
}

export function useServerGameAnalysis(gameId: number | null, enabled: boolean = true): Result {
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [evalByPly, setEvalByPly] = useState<Record<number, WhiteScore>>({});
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const generationRef = useRef(0);

  useEffect(() => {
    if (!enabled || gameId == null) {
      setStatus('idle');
      return;
    }
    const generation = ++generationRef.current;
    setSummary(null);
    setEvalByPly({});
    setStatus('pending');

    async function poll(elapsedMs: number) {
      if (generation !== generationRef.current) return;
      const result = await fetchGameAnalysis(gameId!);
      if (generation !== generationRef.current) return;
      if (result) {
        setSummary(result.summary);
        setEvalByPly(result.evalByPly);
        setStatus('done');
        return;
      }
      if (elapsedMs >= MAX_WAIT_MS) {
        setStatus('error');
        return;
      }
      setTimeout(() => void poll(elapsedMs + POLL_INTERVAL_MS), POLL_INTERVAL_MS);
    }

    async function run() {
      const result = await requestGameAnalysis(gameId!);
      if (generation !== generationRef.current) return;
      if (result === null) {
        setStatus('error');
        return;
      }
      if ('summary' in result) {
        setSummary(result.summary);
        setEvalByPly(result.evalByPly);
        setStatus('done');
        return;
      }
      setTimeout(() => void poll(POLL_INTERVAL_MS), POLL_INTERVAL_MS);
    }

    void run();
  }, [gameId, enabled]);

  return { summary, evalByPly, status };
}
