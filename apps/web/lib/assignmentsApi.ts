import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/** Madde 2026-09-05: Antrenör → Ödev → Dersler köprüsü — Zafer'in Antrenör'de
 *  anlattığı bir Alt Konu'yla ilgili Dersler içeriğini (modül/ders) sınıfa
 *  veya tek bir sporcuya ödev olarak vermesini sağlar. */

export interface TeacherClass {
  id: number;
  name: string;
  join_code: string;
}

export interface StudentSearchResult {
  id: number;
  display_name: string;
  avatar: string;
  class_id: number | null;
  class_name: string | null;
}

export interface AdminModuleSummary {
  id: number;
  order_index: number;
  name: string;
  description: string;
  topics?: string | null;
  lesson_count: number;
  icon: string;
}

export interface AdminLessonSummary {
  id: number;
  module_id: number;
  order_index: number;
  title: string;
  estimated_minutes: number;
}

/** Madde 2026-09-07 (GRUP D): bir dersin Alt Konuları — "Ödev Ver" formunun
 *  3. (opsiyonel) Alt Konu seçicisi. LessonProgressCard'ın kullandığı AYNI
 *  `/lessons/{id}` ucu; Alt Konu = `type === 'explanation'` adımlar. */
export interface LessonStepSummary {
  stepId: number;
  title: string;
}

export interface CreateAssignmentPayload {
  title: string;
  description?: string | null;
  target_module_id?: number | null;
  target_lesson_id?: number | null;
  /** Madde 2026-09-07 (GRUP D): DERS İÇİNDEKİ belirli bir Alt Konu
   *  (lesson_step) hedeflenirse, o Alt Konu'nun "Ödevini Yap" sekmesi
   *  sporcu tarafında aktifleşir (bkz. fetchMyActiveStepIds). */
  target_lesson_step_id?: number | null;
  due_date?: string | null;
  /** Bu ödevin Antrenör'de HANGİ Alt Konu anlatılırken verildiği. */
  source_custom_tab_section_id?: number | null;
}

function authHeaders() {
  const token = getToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export async function listMyClasses(): Promise<TeacherClass[]> {
  try {
    const r = await fetch(`${API_BASE}/teacher/classes`, { headers: authHeaders() });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

export async function searchStudents(q: string): Promise<StudentSearchResult[]> {
  try {
    const r = await fetch(`${API_BASE}/teacher/students/search?q=${encodeURIComponent(q)}`, {
      headers: authHeaders(),
    });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

/** Dersler müfredatındaki tüm modüller — "Ödev Ver" formunun Modül seçici. */
export async function listAdminModules(): Promise<AdminModuleSummary[]> {
  try {
    const r = await fetch(`${API_BASE}/admin/content`, { headers: authHeaders() });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

/** Seçilen modülün dersleri — "Ödev Ver" formunun Ders seçici. */
export async function listAdminModuleLessons(moduleId: number): Promise<AdminLessonSummary[]> {
  try {
    const r = await fetch(`${API_BASE}/admin/modules/${moduleId}/lessons`, { headers: authHeaders() });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

/** Madde 2026-09-07 (GRUP D): seçilen dersin Alt Konuları — "Ödev Ver"
 *  formunun 3. (opsiyonel) seçici. `/lessons/{id}` HERKESE AÇIK bir uç
 *  (LessonProgressCard da aynı şekilde token'sız çağırıyor). */
export async function listLessonSteps(lessonId: number): Promise<LessonStepSummary[]> {
  try {
    const r = await fetch(`${API_BASE}/lessons/${lessonId}`);
    if (!r.ok) return [];
    const data = await r.json();
    return ((data.steps ?? []) as { id: number; type: string; content_json?: { title?: string } }[])
      .filter((s) => s.type === 'explanation' && s.content_json?.title)
      .map((s) => ({ stepId: s.id, title: s.content_json!.title! }));
  } catch {
    return [];
  }
}

export async function createClassAssignment(
  classId: number, payload: CreateAssignmentPayload,
): Promise<{ id: number } | null> {
  try {
    const r = await fetch(`${API_BASE}/teacher/classes/${classId}/assignments`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function createIndividualAssignment(
  childId: number, payload: CreateAssignmentPayload,
): Promise<{ id: number } | null> {
  try {
    const r = await fetch(`${API_BASE}/teacher/students/${childId}/assignments`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export interface StudentAssignment {
  id: number;
  title: string;
  description: string | null;
  due_date: string | null;
  target_module_id: number | null;
  target_lesson_id: number | null;
  target_title: string | null;
  completed: boolean;
}

/** Sporcunun Hızlı Erişim/Dersler → "Ödevlerim" bölümünde göreceği liste. */
export async function listMyAssignments(): Promise<StudentAssignment[]> {
  try {
    const token = getToken();
    const r = await fetch(`${API_BASE}/assignments`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

/**
 * Madde 2026-09-07 (GRUP D): sporcunun (sınıfına ya da doğrudan kendisine)
 * Alt Konu bazlı ödev verilmiş TÜM lesson_step id'leri — LessonProgressCard
 * bunu `/practice/lessons/{id}/scores` gibi diğer verilerle birleştirip
 * hangi Alt Konu'nun normal zincir kilidini EZECEĞİNİ ve "Ödevini Yap"
 * pill'inin mavi mi tamamlandı mı görüneceğini hesaplar. Boş küme = normal
 * davranış (KURAL #3 — bu uç hiç çağrılmasa/başarısız olsa bile mevcut
 * kilit mantığı DEĞİŞMEZ).
 */
export async function fetchMyActiveStepIds(): Promise<Set<number>> {
  try {
    const token = getToken();
    if (!token) return new Set();
    const r = await fetch(`${API_BASE}/assignments/my-active-step-ids`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return new Set();
    const data = await r.json();
    return new Set((data.step_ids ?? []) as number[]);
  } catch {
    return new Set();
  }
}
