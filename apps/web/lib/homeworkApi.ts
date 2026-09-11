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
}

export interface ClassStudent {
  id: number;
  display_name: string;
  avatar?: string;
  age?: number;
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
