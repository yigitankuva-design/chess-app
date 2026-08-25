import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface TournamentSummary {
  id: number;
  name: string;
  rounds_total: number;
  base_ms: number | null;
  increment_ms: number | null;
  status: 'upcoming' | 'active' | 'finished';
  current_round: number | null;
  joined: boolean;
  /** Madde 6 (2026-08-20): "Oyun Modu" — Puanlı turnuvada maçlar Performans
   *  Puanını etkiler. tempo=null ise (tempo 9 sabitten birine eşleşmiyorsa)
   *  rated=true olsa da hiçbir maç puanlanmaz. */
  rated: boolean;
  tempo: string | null;
}

export interface TournamentPairingRow {
  id: number;
  white_child_id: number;
  white_name: string;
  black_child_id: number | null;
  black_name: string | null;
  game_id: number | null;
  result: string | null;
}

export interface TournamentStandingRow {
  child_id: number;
  display_name: string;
  score: number;
  rating: number | null;
  title: string | null;
}

export interface MyPairing {
  id: number;
  round_number: number;
  is_bye: boolean;
  opponent_name: string | null;
  my_color: 'white' | 'black';
  game_id: number | null;
  result: string | null;
}

export interface TournamentDetail {
  id: number;
  name: string;
  rounds_total: number;
  base_ms: number | null;
  increment_ms: number | null;
  status: 'upcoming' | 'active' | 'finished';
  current_round: number | null;
  rated: boolean;
  tempo: string | null;
  standings: TournamentStandingRow[];
  my_pairing: MyPairing | null;
  pairings_by_round: Record<string, TournamentPairingRow[]>;
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function listTournaments(): Promise<TournamentSummary[]> {
  try {
    const r = await fetch(`${API_BASE}/tournaments`, { headers: authHeaders() });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

export async function getTournament(id: number): Promise<TournamentDetail | null> {
  try {
    const r = await fetch(`${API_BASE}/tournaments/${id}`, { headers: authHeaders() });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function joinTournament(id: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/tournaments/${id}/join`, {
      method: 'POST', headers: authHeaders(),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export interface TournamentCreatePayload {
  name: string;
  rounds_total: number;
  base_ms: number | null;
  increment_ms: number | null;
  rated: boolean;
}

export async function createTournament(payload: TournamentCreatePayload): Promise<TournamentSummary | null> {
  try {
    const r = await fetch(`${API_BASE}/tournaments`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function startTournament(id: number): Promise<TournamentDetail | null> {
  try {
    const r = await fetch(`${API_BASE}/tournaments/${id}/start`, { method: 'POST', headers: authHeaders() });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function advanceTournamentRound(id: number): Promise<TournamentDetail | null> {
  try {
    const r = await fetch(`${API_BASE}/tournaments/${id}/next-round`, { method: 'POST', headers: authHeaders() });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function deleteTournament(id: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/tournaments/${id}`, { method: 'DELETE', headers: authHeaders() });
    return r.ok;
  } catch {
    return false;
  }
}

export async function startPairingGame(
  tournamentId: number, pairingId: number,
): Promise<{ game_id: number; color: 'white' | 'black' } | null> {
  try {
    const r = await fetch(`${API_BASE}/tournaments/${tournamentId}/pairings/${pairingId}/start-game`, {
      method: 'POST', headers: authHeaders(),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
