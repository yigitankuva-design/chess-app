import { getToken } from '@/lib/auth-storage';
import type { PracticeMode, ScoreMap } from '@/lib/practice/unlock';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ScoreRow { step_id: number; mode: string; best_score: number }
export interface SubmitResult { score: number; best_score: number; improved: boolean }

/**
 * Dersin tüm alt konuları için en iyi skorlar.
 * null = "kilit sistemi uygulanamaz" (token yok / sunucu erişilemiyor) →
 * çağıran taraf her şeyi AÇIK kabul eder (KURAL #3: kimse dışarıda kalmaz).
 */
export async function fetchLessonScores(lessonId: number): Promise<ScoreMap | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch(`${API_BASE}/practice/lessons/${lessonId}/scores`, {
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
  per_question_correct: boolean[] | null;
  pool_size: number;
}

/**
 * Madde 2026-09-05: Sporcu Profili "Ödevlerim" paneli için — bir alt konu +
 * modun en iyi denemesi (soru bazlı doğru/yanlış dahil) ve güncel havuz
 * büyüklüğü. null = çekilemedi (token yok / ağ hatası).
 */
export async function fetchPracticeDetail(
  stepId: number, mode: PracticeMode,
): Promise<PracticeDetail | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch(`${API_BASE}/practice/steps/${stepId}/detail?mode=${mode}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}
