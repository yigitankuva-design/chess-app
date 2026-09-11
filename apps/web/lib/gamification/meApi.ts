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
  /** Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 4): yeni "Kayıt Ol"
   *  formunun eklediği Lichess kullanıcı adı. */
  lichess_username: string | null;
  /** Madde 2026-09-11 (Görsel Turu Aşama B): düzenlenebilir alanlar.
   *  `country` null = Türkiye. `nickname` maçlarda gerçek isim yerine
   *  görünen ad (Madde 11); `nickname_next_change_at` doluysa ve gelecekteyse
   *  3-ay kilidi aktiftir. Antrenör özetinde de aynı alanlar gelir. */
  country?: string | null;
  nickname?: string | null;
  nickname_changed_at?: string | null;
  nickname_next_change_at?: string | null;
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

/**
 * Madde 2026-09-07 (Antrenör Paneli, 4): antrenör kendi profil fotoğrafını
 * yükler — `uploadMyPhoto` ile AYNI desen, sadece uç farklı
 * (`/teacher/me/photo` — antrenör hesabında ChildProfile YOK).
 */
export async function uploadTeacherPhoto(photoDataUrl: string): Promise<boolean> {
  try {
    const token = getToken();
    if (!token) return false;
    const r = await fetch(`${API_BASE}/teacher/me/photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ photo_data_url: photoDataUrl }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Madde 2026-09-11 (Görsel Turu Aşama B / Madde 3): profil düzenleme.
 *  Gönderilmeyen alan değişmez; boş string telefon/Lichess'i temizler. */
export interface ProfileEditPatch {
  country?: string | null;
  province?: string | null;
  athlete_phone?: string | null;
  lichess_username?: string | null;
  nickname?: string | null;
}

export interface ProfileEditResult {
  country: string | null;
  province: string | null;
  athlete_phone: string | null;
  lichess_username: string | null;
  nickname: string | null;
  nickname_changed_at: string | null;
  nickname_next_change_at: string | null;
}

export type ProfileEditOutcome =
  | { ok: true; data: ProfileEditResult }
  | { ok: false; error: string };

async function patchProfile(path: string, body: Record<string, unknown>): Promise<ProfileEditOutcome> {
  try {
    const token = getToken();
    if (!token) return { ok: false, error: 'Giriş yapılmamış' };
    const r = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const detail = (data as { detail?: unknown }).detail;
      return { ok: false, error: typeof detail === 'string' ? detail : 'Kaydedilemedi' };
    }
    return { ok: true, data: data as ProfileEditResult };
  } catch {
    return { ok: false, error: 'Sunucuya ulaşılamadı' };
  }
}

/** Sporcu kendi profilini düzenler — PATCH /children/me/profile. */
export function updateMyProfile(patch: ProfileEditPatch): Promise<ProfileEditOutcome> {
  return patchProfile('/children/me/profile', { ...patch });
}

/** Antrenör kendi profilini düzenler — PATCH /teacher/me/profile
 *  (telefon alanı sunucuda `phone`; burada sporcuyla AYNI `athlete_phone`
 *  adıyla alınıp çevrilir ki iki profil sayfası aynı formu kullanabilsin). */
export function updateTeacherProfile(patch: ProfileEditPatch): Promise<ProfileEditOutcome> {
  const { athlete_phone, ...rest } = patch;
  const body: Record<string, unknown> = { ...rest };
  if ('athlete_phone' in patch) body.phone = athlete_phone;
  return patchProfile('/teacher/me/profile', body);
}
