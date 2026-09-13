import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Madde 2026-09-11 (Ödev Sistemi Faz 3): antrenör bir Alt Konu'yu
 *  (lesson_step) sporcu(lar)a ödev olarak gönderir. Eski `assignmentsApi.ts`
 *  (modül/ders seviyeli ClassAssignment + GRUP D) tamamen kaldırıldı. */

function authHeaders() {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` };
}

export interface TeacherClass {
  id: number;
  name: string;
  join_code: string;
  /** Madde 2026-09-13 (Sınıflarım yönetimi): ▲/▼ ile belirlenen sıra —
   *  liste zaten bu sıraya göre gelir, alan sadece bilgi amaçlı. */
  order_index: number;
}

export interface ClassStudent {
  id: number;
  display_name: string;
  avatar?: string;
  age?: number;
  /** Madde 2026-09-13 (Sınıf Listesi yönetimi): gerçek foto/nickname
   *  gösterimi + ▲/▼ sıralaması için. */
  nickname: string | null;
  photo_data_url: string | null;
  order_index: number | null;
}

export interface HomeworkTarget {
  linked: boolean;
  section_title: string;
  lesson_step_id?: number;
  alt_konu_title?: string;
  konu_title?: string | null;
  duzey_title?: string | null;
}

export interface SendHomeworkPayload {
  lesson_step_id: number;
  source_section_id?: number | null;
  child_ids?: number[];
  class_ids?: number[];
  start_date: string;   // "YYYY-MM-DD"
  end_date?: string | null;
  note?: string | null;
}

export interface SentHomework {
  id: number;
  lesson_step_id: number;
  alt_konu_title: string | null;
  start_date: string;
  end_date: string | null;
  note: string | null;
  recipient_count: number;
  recipient_names: string[];
  created_at: string;
}

export async function fetchMyClasses(): Promise<TeacherClass[]> {
  try {
    const r = await fetch(`${API_BASE}/teacher/classes`, { headers: authHeaders() });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

export async function fetchClassStudents(classId: number): Promise<ClassStudent[]> {
  try {
    const r = await fetch(`${API_BASE}/teacher/classes/${classId}/students`, { headers: authHeaders() });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

/** Madde 2026-09-13 (Sınıflarım): yeni sınıf oluşturur; join_code sunucuda
 *  üretilir (bkz. teacher.py create_class). */
export async function createClass(name: string): Promise<TeacherClass | null> {
  try {
    const r = await fetch(`${API_BASE}/teacher/classes`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ name }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Madde 2026-09-13 (Sınıflarım yönetimi): sınıfı yeniden adlandırır. */
export async function renameClass(classId: number, name: string): Promise<TeacherClass | null> {
  try {
    const r = await fetch(`${API_BASE}/teacher/classes/${classId}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ name }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Madde 2026-09-13 (Sınıflarım yönetimi): sınıfı siler — sunucu tarafında
 *  içindeki öğrenci/ödev/anket bağlantıları önce çözülür (bkz. teacher.py
 *  delete_class). */
export async function deleteClass(classId: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/teacher/classes/${classId}`, {
      method: 'DELETE', headers: authHeaders(),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Madde 2026-09-13 (Sınıflarım yönetimi): ▲/▼ düğmesi — komşu sınıfla
 *  sırayı takas eder. Listenin ucundaysa sunucu 400 döner. */
export async function moveClass(classId: number, direction: 'up' | 'down'): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/teacher/classes/${classId}/move`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ direction }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Madde 2026-09-13 (Sınıf Listesi yönetimi): ▲/▼ düğmesi — bir sınıftaki
 *  komşu sporcuyla sırayı takas eder. */
export async function moveStudent(classId: number, childId: number, direction: 'up' | 'down'): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/teacher/classes/${classId}/students/${childId}/move`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ direction }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Madde 2026-09-13 (Sınıf Listesi yönetimi, "Sınıf Değiştir"): mevcut
 *  add_student ucu force=true ile — öğrenci başka bir sınıftaysa da taşır. */
export async function changeStudentClass(newClassId: number, childId: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/teacher/classes/${newClassId}/students/${childId}?force=true`, {
      method: 'POST', headers: authHeaders(),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function fetchHomeworkTarget(sectionId: number): Promise<HomeworkTarget | null> {
  try {
    const r = await fetch(`${API_BASE}/homework/target?section_id=${sectionId}`, { headers: authHeaders() });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function sendHomework(
  payload: SendHomeworkPayload,
): Promise<{ id: number; recipient_count: number } | null> {
  try {
    const r = await fetch(`${API_BASE}/homework`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function fetchSentHomework(): Promise<SentHomework[]> {
  try {
    const r = await fetch(`${API_BASE}/homework/sent`, { headers: authHeaders() });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}
