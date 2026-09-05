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

export interface CreateAssignmentPayload {
  title: string;
  description?: string | null;
  target_module_id?: number | null;
  target_lesson_id?: number | null;
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
