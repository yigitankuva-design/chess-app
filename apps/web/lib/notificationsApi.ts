import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Madde 2026-09-11 (Ödev Sistemi Faz 4): sporcu "Bildirimler" sekmesi —
 *  genel amaçlı (6 tür), şu an sadece "odev" türü gerçek veri taşıyor.
 *  Madde 2026-09-11 (Görsel Turu Aşama E / Madde 9): `hoca_notu` eklendi —
 *  antrenör profile not yazınca/değiştirince gerçek veri taşır. */
export type NotificationType = 'odev' | 'turnuva' | 'online_ders' | 'pratik' | 'mac' | 'eglence' | 'hoca_notu';

export interface NotificationTarget {
  lesson_step_id: number;
  lesson_id: number;
  alt_konu_title: string;
}

export interface NotificationItem {
  id: number;
  type: NotificationType;
  title: string;
  subtitle: string | null;
  created_at: string;
  /** null = "Git" düğmesi YEŞİL (henüz gidilmedi); dolu = KIRMIZI (gidildi). */
  visited_at: string | null;
  /** type=odev'de dolu — "Ödevini Yap" sayfasına giden linki kurmaya yeter. */
  target: NotificationTarget | null;
}

export interface NotificationsResponse {
  unread_count: number;
  items: NotificationItem[];
}

function authHeaders() {
  return { Authorization: `Bearer ${getToken()}` };
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  try {
    const r = await fetch(`${API_BASE}/notifications`, { headers: authHeaders() });
    if (!r.ok) return { unread_count: 0, items: [] };
    return await r.json();
  } catch {
    return { unread_count: 0, items: [] };
  }
}

export async function markNotificationVisited(id: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/notifications/${id}/visit`, {
      method: 'POST', headers: authHeaders(),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Bildirim türüne göre ikon — "Ödev Gönder"in dışındaki türlerin henüz
 *  gerçek bir üreticisi yok ama sekme genel amaçlı tasarlandığı için hazır. */
export const NOTIFICATION_TYPE_META: Record<NotificationType, { emoji: string; label: string }> = {
  odev: { emoji: '📌', label: 'Ödev' },
  turnuva: { emoji: '🏆', label: 'Turnuva' },
  online_ders: { emoji: '🎥', label: 'Online Ders' },
  pratik: { emoji: '🧩', label: 'Pratik' },
  mac: { emoji: '🎮', label: 'Maç' },
  eglence: { emoji: '🎉', label: 'Eğlence' },
  hoca_notu: { emoji: '📝', label: 'Hoca Notu' },
};

/** "Ödeve Git" — pratik sayfasının beklediği query string'i kurar
 *  (home/coach'taki mevcut "Ödevini Yap" linkleriyle AYNI desen). */
export function odevTargetHref(target: NotificationTarget): string {
  return `/pratik/suresiz?konu=${encodeURIComponent(target.alt_konu_title)}`
    + `&step=${target.lesson_step_id}&ders=${target.lesson_id}`;
}
