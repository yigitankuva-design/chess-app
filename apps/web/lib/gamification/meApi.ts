import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface MyProgress {
  rank_name: string;
  rank_icon: string;
  xp_total: number;
  next_rank_xp: number;
  badges_earned: number;
  badges_total: number;
  /** Madde 2026-09-06 (Görsel 1): kimlik şeridinde üyelik tarihi. */
  member_since: string;
  /** Madde 2026-09-07 (GRUP B): SADECE antrenör görünümünde (`childId`
   *  verilince) dolu gelir — `/gamification/me`'nin kendisi bunları
   *  döndürmez (çocuk zaten kendi adını/avatarını cihazından biliyor). */
  display_name?: string;
  avatar?: string;
}

/**
 * `/gamification/me` — kendi rütbe/XP/rozet ilerlemesi.
 *
 * `childId` verilirse (madde 2026-09-07, GRUP B: antrenörün salt-okunur
 * Sporcu Profili görünümü) `/teacher/students/{childId}/profile-summary`'ye
 * gider — antrenörün KENDİ token'ıyla, sadece uç değişir; dönen şekil AYNI.
 */
export async function fetchMyProgress(childId?: number): Promise<MyProgress | null> {
  try {
    const token = getToken();
    const path = childId != null
      ? `/teacher/students/${childId}/profile-summary`
      : '/gamification/me';
    const r = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
