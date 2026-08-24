import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface GameSummary {
  id: number;
  type: 'bot' | 'human';
  result: '1-0' | '0-1' | '1/2-1/2' | null;
  student_color: 'w' | 'b' | null;
  started_at: string;
  finished_at: string | null;
  opponent: { type: 'bot'; level: number | null } | { type: 'human'; name: string | null };
  /** Açılış pratiğinden başlayan maçlarda standart olmayan başlangıç konumu. */
  start_fen: string | null;
}

export interface GameMoveDto {
  ply: number;
  san: string;
  fen_after: string;
}

/** Analiz Et sekmesi — "Son Maçlarımı İncele": sporcunun bitmiş maçlarının listesi. */
export async function listMyGames(limit = 20): Promise<GameSummary[]> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/games?limit=${limit}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

/** Analiz Et sekmesi — seçilen maçın tam hamle listesi (hamle hamle geri/ileri için). */
export async function getGameMoves(gameId: number): Promise<GameMoveDto[]> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/games/${gameId}/moves`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}
