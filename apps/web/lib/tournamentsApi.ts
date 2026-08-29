import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Lichess Arena modeli (2026-09-05): sabit tur sayısı yok, sabit SÜRE var —
 *  sporcu maçını bitirip sayfaya dönünce anında en yakın puanlı rakiple eşleşir. */
export interface TournamentSummary {
  id: number;
  name: string;
  starts_at: string;
  duration_minutes: number;
  ends_at: string;
  seconds_remaining: number;
  base_ms: number | null;
  increment_ms: number | null;
  status: 'upcoming' | 'active' | 'finished';
  joined: boolean;
  /** Madde 6 (2026-08-20): "Oyun Modu" — Puanlı turnuvada maçlar Performans
   *  Puanını etkiler. tempo=null ise (tempo 9 sabitten birine eşleşmiyorsa)
   *  rated=true olsa da hiçbir maç puanlanmaz. */
  rated: boolean;
  tempo: string | null;
  /** Madde 2026-09-06 ("Turnuva Oluştur" ekranı). */
  description: string | null;
  /** Tüm eşleşmeler bu FEN'den başlar — boş/null = standart başlangıç. */
  start_fen: string | null;
  /** "Galibiyet Ödülü": açıkken 2 galibiyet üst üste sonraki sonucu katlar. */
  winning_streak_bonus: boolean;
  /** Madde 2026-09-07 (lobi tablosu — "Katılımcı Sayısı" sütunu). */
  participant_count: number;
}

export interface TournamentPairingRow {
  id: number;
  white_child_id: number;
  white_name: string | null;
  black_child_id: number;
  black_name: string | null;
  game_id: number | null;
  result: string | null;
}

export interface TournamentStandingRow {
  child_id: number;
  display_name: string | null;
  score: number;
  /** Sonneborn-Berger ("averaj") — puan eşitliğinde sıralama tayin eder. */
  sb: number;
  /** Üst üste kaç galibiyet — 2'ye ulaşınca sonraki sonuç katlanır (🔥). */
  streak: number;
  rating: number | null;
  title: string | null;
  /** Madde 2026-09-09 (6): turnuva bitiş bildirimi (ilk 3) için — void/devam
   *  eden eşleşmeler sayılmaz. */
  games_played: number;
  /** Yüzde (0-100), games_played=0 ise null. */
  win_rate: number | null;
}

export interface MyActivePairing {
  id: number;
  opponent_id: number;
  opponent_name: string | null;
  my_color: 'white' | 'black';
  game_id: number | null;
}

export interface TournamentDetail extends TournamentSummary {
  standings: TournamentStandingRow[];
  /** Şu an süren (henüz sonuçlanmamış) eşleşmen — round kavramı yok. */
  my_pairing: MyActivePairing | null;
  recent_pairings: TournamentPairingRow[];
  /** Madde 2026-09-09 (4): "Turnuvayı Sil" SADECE oluşturana VE SADECE
   *  turnuva henüz başlamadıysa true. */
  can_delete: boolean;
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

/** Madde 2026-09-09 (5): sporcu istediği zaman turnuvadan çıkabilsin. */
export async function leaveTournament(id: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/tournaments/${id}/leave`, {
      method: 'POST', headers: authHeaders(),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export interface TournamentCreatePayload {
  name: string;
  starts_at: string;          // ISO tarih-saat
  duration_minutes: number;
  base_ms: number | null;
  increment_ms: number | null;
  rated: boolean;
  description?: string | null;
  start_fen?: string | null;
  winning_streak_bonus?: boolean;
}

export type CreateTournamentResult =
  | { ok: true; data: TournamentSummary }
  | { ok: false; error: string };

/** FastAPI hata govdesi ya duz metin (`{"detail": "..."}` — HTTPException) ya
 *  da pydantic dogrulama listesi (`{"detail": [{"msg": "...", ...}, ...]}` —
 *  422) olabilir; ikisini de okunabilir tek satira cevirir. */
function _errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const msgs = detail.map((d) => (d as { msg?: string })?.msg).filter(Boolean);
    if (msgs.length > 0) return msgs.join(', ');
  }
  return fallback;
}

export async function createTournament(payload: TournamentCreatePayload): Promise<CreateTournamentResult> {
  try {
    const r = await fetch(`${API_BASE}/tournaments`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
    });
    const body = await r.json().catch(() => null);
    if (!r.ok) return { ok: false, error: _errorMessage(body, 'Turnuva oluşturulamadı') };
    return { ok: true, data: body };
  } catch {
    return { ok: false, error: 'Sunucuya bağlanılamadı' };
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
