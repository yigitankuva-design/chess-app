import { getToken } from '@/lib/auth-storage';
import type { GameSummary } from '@/lib/chess/gameSummary';
import type { WhiteScore } from '@/lib/chess/moveQuality';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Madde 2026-09-14 (sunucu analiz motoru): motor artık BACKEND'de (native
 * Stockfish) çalışıyor — istemci sadece TETİKLER (`requestGameAnalysis`,
 * POST) ve sonucu POLL eder (`fetchGameAnalysis`, GET). `saveGameAnalysis`
 * kaldırıldı — istemcinin backend'e yükleyecek bir sonucu artık YOK.
 */

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

interface ApiPhaseAccuracy {
  opening: number | null;
  middlegame: number | null;
  endgame: number | null;
}

interface ApiMistakeMove {
  ply: number;
  fen_before: string;
  played_san: string;
  best_move: string;
  cp_loss: number;
  severity: 'inaccuracy' | 'mistake' | 'blunder';
}

interface ApiEvalByPly {
  ply: number;
  cp: number | null;
  mate: number | null;
}

interface ApiDoneAnalysis {
  status: 'done';
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  acpl: number | null;
  accuracy: number | null;
  phase_accuracy: ApiPhaseAccuracy;
  mistake_moves: ApiMistakeMove[];
  eval_by_ply: ApiEvalByPly[];
}

interface ApiPendingAnalysis {
  status: 'pending';
}

export interface ServerAnalysisResult {
  summary: GameSummary;
  evalByPly: Record<number, WhiteScore>;
}

function fromApi(a: ApiDoneAnalysis): ServerAnalysisResult {
  return {
    summary: {
      inaccuracies: a.inaccuracies,
      mistakes: a.mistakes,
      blunders: a.blunders,
      acpl: a.acpl,
      accuracy: a.accuracy,
      phaseAccuracy: {
        opening: a.phase_accuracy.opening,
        middlegame: a.phase_accuracy.middlegame,
        endgame: a.phase_accuracy.endgame,
      },
      mistakeMoves: a.mistake_moves.map((m) => ({
        ply: m.ply, fenBefore: m.fen_before, playedSan: m.played_san,
        bestMove: m.best_move, cpLoss: m.cp_loss, severity: m.severity,
      })),
    },
    evalByPly: Object.fromEntries(a.eval_by_ply.map((e) => [e.ply, { cp: e.cp, mate: e.mate }])),
  };
}

/** Bu maçın analiz edilmesini TETİKLER — motor backend'de native Stockfish
 *  ile çalışır (bkz. apps/api/chess_api/services/game_analysis_engine.py).
 *  Zaten hesaplanmışsa sonucu DİREKT döner (motor tekrar çalışmaz); henüz
 *  değilse arka planda başlatır ve `{status:'pending'}` döner — çağıran
 *  taraf bu durumda `fetchGameAnalysis`'i POLL eder. Ağ hatasında `null`. */
export async function requestGameAnalysis(
  gameId: number,
): Promise<ServerAnalysisResult | { status: 'pending' } | null> {
  try {
    const r = await fetch(`${API_BASE}/games/${gameId}/analysis`, {
      method: 'POST', headers: authHeaders(),
    });
    if (!r.ok) return null;
    const data: ApiDoneAnalysis | ApiPendingAnalysis = await r.json();
    return data.status === 'done' ? fromApi(data) : { status: 'pending' };
  } catch {
    return null;
  }
}

/** Sonuç hazırsa döner — henüz değilse (404) `null` (çağıran taraf POLL'a
 *  devam eder). Motor ÇALIŞTIRMAZ, sadece okur. */
export async function fetchGameAnalysis(gameId: number): Promise<ServerAnalysisResult | null> {
  try {
    const r = await fetch(`${API_BASE}/games/${gameId}/analysis`, { headers: authHeaders() });
    if (!r.ok) return null;
    return fromApi(await r.json());
  } catch {
    return null;
  }
}
