import { getToken } from '@/lib/auth-storage';
import type { GameSummary } from '@/lib/chess/gameSummary';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Madde 2026-09-14 (3b/4): "Analiz Et" özetini backend'e kaydeder/okur —
 * motor hâlâ İSTEMCİDE çalışıyor (bkz. lib/chess/gameSummary.ts), bu
 * SADECE sonucu saklar ki aynı maç ikinci kez açıldığında (Maçlarımın
 * Analizi) motor baştan çalışmasın; "Hatalarını Gözden Geçir" de
 * mistakeMoves'u doğrudan kullanabilsin (madde 3c).
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

interface ApiGameAnalysis {
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  acpl: number | null;
  accuracy: number | null;
  phase_accuracy: ApiPhaseAccuracy;
  mistake_moves: ApiMistakeMove[];
}

function fromApi(a: ApiGameAnalysis): GameSummary {
  return {
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
  };
}

function toApiBody(summary: GameSummary) {
  return {
    inaccuracies: summary.inaccuracies,
    mistakes: summary.mistakes,
    blunders: summary.blunders,
    acpl: summary.acpl,
    accuracy: summary.accuracy,
    phase_accuracy_opening: summary.phaseAccuracy.opening,
    phase_accuracy_middlegame: summary.phaseAccuracy.middlegame,
    phase_accuracy_endgame: summary.phaseAccuracy.endgame,
    mistake_moves: summary.mistakeMoves.map((m) => ({
      ply: m.ply, fen_before: m.fenBefore, played_san: m.playedSan,
      best_move: m.bestMove, cp_loss: m.cpLoss, severity: m.severity,
    })),
  };
}

/** Daha önce kaydedilmiş özet varsa döner — motor ÇALIŞTIRMAZ. Yoksa null
 *  (henüz hiç analiz edilmemiş — çağıran taraf istemcide hesaplayıp
 *  saveGameAnalysis ile kaydeder). */
export async function fetchGameAnalysis(gameId: number): Promise<GameSummary | null> {
  try {
    const r = await fetch(`${API_BASE}/games/${gameId}/analysis`, { headers: authHeaders() });
    if (!r.ok) return null;
    return fromApi(await r.json());
  } catch {
    return null;
  }
}

/** İstemcide hesaplanan özeti kaydeder (upsert) — false = kaydedilemedi,
 *  sessizce yoksayılabilir (kritik olmayan bir önbellekleme, sporcunun
 *  gördüğü sonucu ETKİLEMEZ). */
export async function saveGameAnalysis(gameId: number, summary: GameSummary): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/games/${gameId}/analysis`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(toApiBody(summary)),
    });
    return r.ok;
  } catch {
    return false;
  }
}
