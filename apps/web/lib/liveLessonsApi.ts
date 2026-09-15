import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Madde 2026-09-15: Online Dersler (canlı ders) — LiveKit self-hosted ile
 *  ses/görüntü, bu dosya SADECE dersin YAŞAM DÖNGÜSÜNÜ (oluştur/başlat/
 *  bitir/katıl/ayrıl) ve LiveKit bağlantı token'ını yönetir. Ders-içi
 *  gerçek zamanlı durum (tahta/yetki/sohbet) `/ws/live-lesson/{id}`
 *  WebSocket'i üzerinden ayrıca yürür (bkz. useLiveLessonRoom.ts). */

export type LiveLessonStatus = 'scheduled' | 'live' | 'ended';
export type LiveLessonJoinMode = 'auto' | 'approval';

export interface LiveLesson {
  id: number;
  class_id: number;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  join_mode: LiveLessonJoinMode;
  status: LiveLessonStatus;
  started_at: string | null;
  ended_at: string | null;
}

export interface CreateLiveLessonPayload {
  class_id: number;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  join_mode: LiveLessonJoinMode;
}

export interface LiveKitConnectionInfo {
  token: string;
  livekit_url: string;
}

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

export async function fetchMyLiveLessons(): Promise<LiveLesson[]> {
  try {
    const r = await fetch(`${API_BASE}/live-lessons`, { headers: authHeaders() });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

export async function fetchLiveLesson(lessonId: number): Promise<LiveLesson | null> {
  try {
    const r = await fetch(`${API_BASE}/live-lessons/${lessonId}`, { headers: authHeaders() });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function createLiveLesson(payload: CreateLiveLessonPayload): Promise<LiveLesson | null> {
  try {
    const r = await fetch(`${API_BASE}/live-lessons`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Antrenör dersi başlatır — LiveKit odasını açar, host bağlantı
 *  bilgisini döner (ses+görüntü+oda yönetimi yetkisiyle). */
export async function startLiveLesson(lessonId: number): Promise<LiveKitConnectionInfo | null> {
  try {
    const r = await fetch(`${API_BASE}/live-lessons/${lessonId}/start`, {
      method: 'POST', headers: authHeaders(),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function endLiveLesson(lessonId: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/live-lessons/${lessonId}/end`, {
      method: 'POST', headers: authHeaders(),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export type JoinRequestResult =
  | { status: 'pending' }
  | { status: 'admitted'; token: string; livekit_url: string }
  | { status: 'denied' }
  | null;

/** Madde 3: "Online Derse Katıl" — `join_mode='auto'` ise ya da sporcu
 *  DAHA ÖNCE onaylandıysa (sticky) anında bağlantı bilgisi döner; aksi
 *  halde `pending` döner ve çağıran taraf `pollLiveLessonJoinStatus`'u
 *  POLL eder (apps/web/lib/chess/useServerGameAnalysis.ts'teki AYNI
 *  iste+poll deseni). */
export async function requestLiveLessonJoin(lessonId: number): Promise<JoinRequestResult> {
  try {
    const r = await fetch(`${API_BASE}/live-lessons/${lessonId}/join-request`, {
      method: 'POST', headers: authHeaders(),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function pollLiveLessonJoinStatus(lessonId: number): Promise<JoinRequestResult> {
  try {
    const r = await fetch(`${API_BASE}/live-lessons/${lessonId}/join-status`, { headers: authHeaders() });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function leaveLiveLesson(lessonId: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/live-lessons/${lessonId}/leave`, {
      method: 'POST', headers: authHeaders(),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Antrenörün onay/red kontrolü ("izinli katılım" modunda). */
export async function admitLiveLessonParticipant(
  lessonId: number, childId: number, admit: boolean,
): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/live-lessons/${lessonId}/admit`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ child_id: childId, admit }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** `/ws/live-lesson/{id}` bağlantı URL'i — token query-string'te taşınır
 *  (`live_game.py`'deki mevcut desenle AYNI, tarayıcı WS handshake'inde
 *  özel header ayarlayamıyor). */
export function liveLessonWsUrl(lessonId: number): string {
  const wsBase = API_BASE.replace(/^http/, 'ws');
  return `${wsBase}/live-lessons/ws/live-lesson/${lessonId}?token=${encodeURIComponent(getToken() ?? '')}`;
}
