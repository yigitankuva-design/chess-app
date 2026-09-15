import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Madde 2026-09-16: Aday Hamle Pratiği — sporcu tarafı oturum akışı.
 *  Motor SADECE admin tarafında (Analiz Et) çalışır; burada yalnızca
 *  sporcunun UCI hamlelerini kayıtlı cevap anahtarıyla karşılaştıran,
 *  süreli bir oturum yaşam döngüsü var. */

export interface AdayHamlePosition {
  id: string;
  fen: string;
}

export interface CreateAdayHamleSessionResult {
  id: number;
  duration_minutes: number;
  current_index: number;
  total: number;
  position: AdayHamlePosition;
}

export interface AdayHamleAnswerResult {
  results: boolean[];
  finished: boolean;
  next_position: AdayHamlePosition | null;
}

export interface AdayHamleCandidateMove {
  move_uci: string;
  move_san: string;
  score_cp: number | null;
  mate: number | null;
}

export interface AdayHamleSessionItem {
  fen: string;
  candidate_moves: AdayHamleCandidateMove[];
  student_moves: string[];
  results: boolean[];
}

export interface AdayHamleSessionDetail {
  id: number;
  duration_minutes: number;
  started_at: string;
  ended_at: string | null;
  items: AdayHamleSessionItem[];
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

export async function createAdayHamleSession(
  sectionId: number, durationMinutes: number,
): Promise<CreateAdayHamleSessionResult | null> {
  try {
    const r = await fetch(`${API_BASE}/aday-hamle/sessions`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ section_id: sectionId, duration_minutes: durationMinutes }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function submitAdayHamleAnswer(
  sessionId: number, moves: string[],
): Promise<AdayHamleAnswerResult | null> {
  try {
    const r = await fetch(`${API_BASE}/aday-hamle/sessions/${sessionId}/answer`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ moves }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function finishAdayHamleSession(sessionId: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/aday-hamle/sessions/${sessionId}/finish`, {
      method: 'POST', headers: authHeaders(),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function fetchAdayHamleSession(sessionId: number): Promise<AdayHamleSessionDetail | null> {
  try {
    const r = await fetch(`${API_BASE}/aday-hamle/sessions/${sessionId}`, { headers: authHeaders() });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
