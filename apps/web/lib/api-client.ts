import { getToken } from './auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    // Madde 2026-09-09 (Üyelik Girişi Yenileme): backend'in gönderdiği
    // {detail: "..."} varsa onu kullan (ör. "Kullanıcı adı zaten
    // kullanılıyor") — yoksa eski genel mesaja düş (KURAL #3, mevcut
    // çağıranlar hâlâ sadece .status'e bakabiliyor).
    let detail: string | undefined;
    try {
      const body = await res.clone().json();
      if (typeof body?.detail === 'string') detail = body.detail;
    } catch {
      // JSON değil / boş gövde — genel mesaja düş
    }
    throw new ApiError(res.status, detail ?? `API ${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
}

// ===== Schemas =====

export interface HealthResponse {
  status: string;
  service: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  role: 'parent' | 'teacher' | 'athlete' | 'admin';
  name: string;
  /** Madde 2026-09-09 (Üyelik Girişi Yenileme): 'pending' ise otomatik
   *  giriş/yönlendirme YAPILMAZ — token teknik olarak dönse de backend
   *  reddeder (bkz. dependencies/auth.py), bu SADECE UX için. */
  approval_status?: 'approved' | 'pending';
}

export interface ParentSignupBody {
  email: string;
  password: string;
  name: string;
  athlete_name?: string;
}

/** Madde 2026-09-09 (Üyelik Girişi Yenileme): "Kayıt Ol" formunun "Üye"
 *  (Sporcu) yolu — POST /auth/member/signup. */
export interface MemberSignupBody {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  province: string;
  lichess_username?: string;
  username: string;
  password: string;
  birth_date: string; // YYYY-MM-DD
  father_name?: string;
  father_phone?: string;
  father_email?: string;
  mother_name?: string;
  mother_phone?: string;
  mother_email?: string;
  kvkk_consent: boolean;
}

/** Madde 2026-09-09 (Üyelik Girişi Yenileme): "Kayıt Ol" formunun
 *  "Antrenör" yolu — POST /auth/teacher/register (mevcut basit
 *  /auth/teacher/signup'a DOKUNULMADI, bu AYRI bir uç). */
export interface TeacherRegisterBody {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  province: string;
  lichess_username?: string;
  username: string;
  password: string;
  kvkk_consent: boolean;
}

export interface LoginBody {
  email: string;
  password: string;
}

// ===== Client =====

export const apiClient = {
  health: () => request<HealthResponse>('/health'),

  parentSignup: (body: ParentSignupBody) =>
    request<AuthResponse>('/auth/parent/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  teacherSignup: (body: ParentSignupBody) =>
    request<AuthResponse>('/auth/teacher/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  // Madde 2026-09-09 (Üyelik Girişi Yenileme): yeni "Kayıt Ol" formunun
  // iki yolu — bkz. MemberSignupBody/TeacherRegisterBody açıklamaları.
  memberSignup: (body: MemberSignupBody) =>
    request<AuthResponse>('/auth/member/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  teacherRegister: (body: TeacherRegisterBody) =>
    request<AuthResponse>('/auth/teacher/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: LoginBody) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  childEnter: (body: { child_profile_id: number; device_fingerprint: string }) =>
    request<{ access_token: string; child_profile_id: number; display_name: string }>(
      '/auth/child/enter',
      { method: 'POST', body: JSON.stringify(body) },
    ),

  athleteSession: () =>
    request<{ access_token: string; child_profile_id: number; display_name: string }>(
      '/auth/athlete/session',
      { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` } },
    ),

  athleteCreate: (body: { full_name: string }) =>
    request<{ access_token: string; child_profile_id: number; display_name: string }>(
      '/auth/athlete/create',
      { method: 'POST', body: JSON.stringify(body), headers: { Authorization: `Bearer ${getToken()}` } },
    ),
};
