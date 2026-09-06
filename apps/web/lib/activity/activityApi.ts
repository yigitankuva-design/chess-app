import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Madde 2026-09-06: Sporcu Profili "Bu Hafta" kartı — Maç Yap/Dersler/
 *  Pratik Yap süre takibi. İstemci oturum süresini ölçer, sunucuya
 *  gönderir (puzzles.py'nin zaten kurduğu desenle AYNI — sunucu puanlamaya
 *  güvenmez ama süreye güvenir, KURAL: mevcut desenden sapma yok). */
export type ActivityCategory = 'play' | 'lessons' | 'practice';

/** Fire-and-forget — başarısız olursa sessizce yutulur (profil kartı
 *  eksik veriyle çalışmaya devam eder, öğrenci akışını ASLA bloklamaz). */
export async function logActivityTime(category: ActivityCategory, seconds: number): Promise<void> {
  if (seconds <= 0) return;
  try {
    const token = getToken();
    await fetch(`${API_BASE}/activity/log-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ category, seconds: Math.round(seconds) }),
    });
  } catch { /* ignore — bkz. yukarıdaki not */ }
}

export interface DaySummary {
  date: string;
  week_start: string;
  week_days: { date: string; weekday: number; has_activity: boolean }[];
  daily: { play_seconds: number; lessons_seconds: number; practice_seconds: number };
  monthly: { play_seconds: number; lessons_seconds: number; practice_seconds: number };
}

export async function fetchDaySummary(dateStr?: string): Promise<DaySummary | null> {
  try {
    const token = getToken();
    const qs = dateStr ? `?date_str=${encodeURIComponent(dateStr)}` : '';
    const r = await fetch(`${API_BASE}/activity/day-summary${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
