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
  /** Madde 2026-09-07 (GRUP C): kimlik kartları — hepsi doldurulmadıysa null. */
  photo_data_url: string | null;
  province: string | null;
  athlete_phone: string | null;
  athlete_email: string | null;
  father_name: string | null;
  father_phone: string | null;
  father_email: string | null;
  mother_name: string | null;
  mother_phone: string | null;
  mother_email: string | null;
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

/**
 * Madde 2026-09-07 (Antrenör Paneli): antrenörün KENDİ Profil sayfası
 * (`/coach/profile`) `fetchMyProgress`'i DEĞİL bunu çağırır — antrenörün
 * rütbe/XP/rozet sistemi yok, `/teacher/me/profile-summary` sadece
 * gerçekten var olan alanları (isim, üyelik tarihi) doldurup geri kalanını
 * null/0 döner. Sporcunun kendi `/gamification/me` akışına (fetchMyProgress)
 * KASITLI OLARAK dokunulmadı (KURAL #3).
 */
export async function fetchTeacherProgress(): Promise<MyProgress | null> {
  try {
    const token = getToken();
    const r = await fetch(`${API_BASE}/teacher/me/profile-summary`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * Madde 2026-09-07 (GRUP C): sporcu kendi profil fotoğrafını yükler
 * (dairesel foto alanına tıklayınca cihazdan/kameradan seçilen görsel,
 * istemci tarafında küçültülüp bir "data:image/...;base64,..." string'e
 * çevrilmiş hâlde buraya gelir — bkz. components/profile/ProfileView.tsx
 * resizeImageToDataUrl). Başarısızsa false — sayfa ikon avatarı göstermeye
 * devam eder (KURAL #3: fotoğraf yoksa mevcut davranış bozulmaz).
 */
export async function uploadMyPhoto(photoDataUrl: string): Promise<boolean> {
  try {
    const token = getToken();
    if (!token) return false;
    const r = await fetch(`${API_BASE}/children/me/photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ photo_data_url: photoDataUrl }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
