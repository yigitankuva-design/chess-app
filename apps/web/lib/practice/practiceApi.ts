import { getToken } from '@/lib/auth-storage';
import type { PracticeMode, ScoreMap } from '@/lib/practice/unlock';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ScoreRow { step_id: number; mode: string; best_score: number }
export interface SubmitResult { score: number; best_score: number; improved: boolean }

/**
 * Dersin tüm alt konuları için en iyi skorlar.
 * null = "kilit sistemi uygulanamaz" (token yok / sunucu erişilemiyor) →
 * çağıran taraf her şeyi AÇIK kabul eder (KURAL #3: kimse dışarıda kalmaz).
 *
 * `childId` verilirse (madde 2026-09-07, GRUP B: antrenörün salt-okunur
 * Sporcu Profili görünümü) `/teacher/students/{childId}/practice/...`'e
 * gider — antrenörün KENDİ token'ıyla, sadece uç değişir.
 */
export async function fetchLessonScores(lessonId: number, childId?: number): Promise<ScoreMap | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const path = childId != null
      ? `/teacher/students/${childId}/practice/lessons/${lessonId}/scores`
      : `/practice/lessons/${lessonId}/scores`;
    const r = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const data = await r.json();
    const map: ScoreMap = {};
    for (const row of (data.scores ?? []) as ScoreRow[]) {
      (map[row.step_id] ??= {})[row.mode as PracticeMode] = row.best_score;
    }
    return map;
  } catch {
    return null;
  }
}

/**
 * Oturum sonucunu kaydeder. null = kaydedilemedi (token yok / ağ hatası) —
 * sonuç ekranı yine gösterilir, sadece kalıcı kayıt ve kilit açma atlanır.
 *
 * `perQuestion` (opsiyonel, madde 2026-09-05): bu oturumdaki HER sorunun
 * (ekrandaki sırayla) doğru/yanlış listesi — Sporcu Profili "Ödevlerim"
 * panelindeki soru bazlı yeşil/kırmızı kareler için.
 */
export async function submitPracticeResult(
  stepId: number, mode: PracticeMode, correct: number, total: number,
  perQuestion?: boolean[],
): Promise<SubmitResult | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch(`${API_BASE}/practice/steps/${stepId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        mode, correct, total, ...(perQuestion ? { per_question: perQuestion } : {}),
      }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export interface PracticeDetail {
  best_score: number;
  best_correct: number;
  best_total: number;
  attempts_count: number;
  /** Madde 2026-09-11: "suresiz"te birikimli — henüz cevaplanmamış sorular null. */
  per_question_correct: (boolean | null)[] | null;
  pool_size: number;
  /** Madde 2026-09-11 (Ödev Sistemi, Faz 1) — SADECE "suresiz" için anlamlı. */
  completed?: boolean;
  answered_count?: number;
}

/** Madde 2026-09-11 (Ödev Sistemi, Faz 1): "Ödevini Yap" (suresiz) birikimli
 *  ilerleme durumu — pratik ekranı kaldığı yerden devam eder. */
export interface OdevProgress {
  total: number;
  answered_count: number;
  correct_count: number;
  completed: boolean;
  per_question_correct: (boolean | null)[];
}

/** "Ödevini Yap"ta bir sorunun cevabını (doğru/yanlış) BİRİKİMLİ kaydeder.
 *  question_index = havuzdaki (admin sırası) 0-tabanlı index. null = kaydedilemedi. */
export async function submitOdevAnswer(
  stepId: number, questionIndex: number, correct: boolean,
): Promise<OdevProgress | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch(`${API_BASE}/practice/steps/${stepId}/odev/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ question_index: questionIndex, correct }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** "Ödevini Yap" birikimli ilerlemesi — pratik ekranı (sporcunun kendisi)
 *  kaldığı yerden devam etsin diye. null = çekilemedi.
 *  (Antrenörün salt-okunur görünümü için fetchPracticeDetail(mode='suresiz')
 *  zaten completed/answered_count döndürür — ayrı bir uç gerekmez.) */
export async function fetchOdevProgress(stepId: number): Promise<OdevProgress | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch(`${API_BASE}/practice/steps/${stepId}/odev/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/**
 * Madde 2026-09-05: Sporcu Profili "Ödevlerim" paneli için — bir alt konu +
 * modun en iyi denemesi (soru bazlı doğru/yanlış dahil) ve güncel havuz
 * büyüklüğü. null = çekilemedi (token yok / ağ hatası).
 */
export async function fetchPracticeDetail(
  stepId: number, mode: PracticeMode, childId?: number,
): Promise<PracticeDetail | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const path = childId != null
      ? `/teacher/students/${childId}/practice/steps/${stepId}/detail?mode=${mode}`
      : `/practice/steps/${stepId}/detail?mode=${mode}`;
    const r = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export interface PeriodStat { total: number; correct: number; wrong: number; success_rate: number }
export interface AttemptsSummary { daily: PeriodStat; weekly: PeriodStat; monthly: PeriodStat; yearly: PeriodStat }

/** Madde 2026-09-06 (Görsel 6): "Süreli Pratik Yap" — günlük/haftalık/aylık/
 *  yıllık istatistik (takvim dönemleri). null = çekilemedi. */
export async function fetchAttemptsSummary(
  stepId: number, mode: PracticeMode, childId?: number,
): Promise<AttemptsSummary | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const path = childId != null
      ? `/teacher/students/${childId}/practice/steps/${stepId}/attempts-summary?mode=${mode}`
      : `/practice/steps/${stepId}/attempts-summary?mode=${mode}`;
    const r = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export interface AttemptRow {
  attempt_no: number;
  correct_count: number;
  total_count: number;
  per_question_correct: boolean[] | null;
}

/** Madde 2026-09-06 (Görsel 7): "Kendini Test Et" — bu alt konudaki TÜM
 *  denemeler ("Sınav-1", "Sınav-2", ...), attempt_no sırasıyla. */
export async function fetchAttempts(
  stepId: number, mode: PracticeMode, childId?: number,
): Promise<AttemptRow[] | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const path = childId != null
      ? `/teacher/students/${childId}/practice/steps/${stepId}/attempts?mode=${mode}`
      : `/practice/steps/${stepId}/attempts?mode=${mode}`;
    const r = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.attempts ?? [];
  } catch {
    return null;
  }
}
