'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { ExerciseForm } from '@/components/admin/ExerciseForm';
import { CollapsibleCard } from '@/components/admin/CollapsibleCard';
import type { BoardExercise } from '@/components/admin/ExerciseForm';
import { assignExerciseCodes, nextExerciseCode } from '@/lib/exerciseCodes';
import { exerciseBadgeTitle } from '@/lib/exerciseBadge';
import { difficultyColor } from '@/lib/difficultyLabels';
import { InlineTitleEdit } from '@/components/admin/InlineTitleEdit';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Alt konu soruları 3 pratik modunda ayrı listelerde saklanır.
// 'untimed' = mevcut board_exercises (öğrenci tarafı bununla çalışır — geriye uyumlu).
// Renkler Hızlı Erişim'deki pratik kartlarıyla aynı (uyumlu tasarım).
const EX_MODES: { key: string; field: string; label: string; emoji: string; color: string }[] = [
  { key: 'untimed', field: 'board_exercises',       label: 'Süresiz Pratik Yap', emoji: '♾️', color: '#2dd4bf' },
  { key: 'timed',   field: 'board_exercises_timed',  label: 'Süreli Pratik Yap',  emoji: '⏱️', color: '#fbbf24' },
  { key: 'test',    field: 'board_exercises_test',   label: 'Kendini Test Et',    emoji: '📝', color: '#a78bfa' },
];

interface QuizQuestion { prompt: string; options: string[]; correct_index: number }
interface StepRow {
  id: number;
  lesson_id: number;
  order_index: number;
  type: string;
  content_json: Record<string, unknown>;
  correct_answer_json: Record<string, unknown> | null;
}

export default function AdminStepEditorPage() {
  const params = useParams();
  const router = useRouter();
  const lessonId = params.lessonId as string;
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [expTitle, setExpTitle] = useState('');
  const [expBody, setExpBody] = useState('');

  const [qPrompt, setQPrompt] = useState('');
  const [qOptions, setQOptions] = useState<string[]>(['', '']);
  const [qCorrect, setQCorrect] = useState(0);

  // Madde 2: sayfa yenilenince (F5) hangi alt konu/mod/soru acikti — o pozisyonda
  // kalinsin. sessionStorage: sekme kapaninca temizlenir, ama F5'te KALICIDIR.
  const uiKey = `bsa:admin-ders:${lessonId}`;
  function loadUiState(): {
    openExercises: number | null;
    openMode: { stepId: number; field: string } | null;
    editingExercise: { stepId: number; field: string; idx: number } | null;
  } {
    if (typeof window === 'undefined') return { openExercises: null, openMode: null, editingExercise: null };
    try {
      const raw = sessionStorage.getItem(uiKey);
      if (!raw) return { openExercises: null, openMode: null, editingExercise: null };
      const p = JSON.parse(raw);
      return {
        openExercises: typeof p.openExercises === 'number' ? p.openExercises : null,
        openMode: p.openMode ?? null,
        editingExercise: p.editingExercise ?? null,
      };
    } catch {
      return { openExercises: null, openMode: null, editingExercise: null };
    }
  }
  const initialUi = loadUiState();
  const [openExercises, setOpenExercises] = useState<number | null>(initialUi.openExercises);
  const [openMode, setOpenMode] = useState<{ stepId: number; field: string } | null>(initialUi.openMode);
  const [editingExercise, setEditingExercise] = useState<{ stepId: number; field: string; idx: number } | null>(initialUi.editingExercise);
  /** "Soru Sayısını Belirle" ve "Başarı Puanı Belirle" kutuları — o an açık
   *  moda ait taslak değerler. İkisi de dolu olmadan kaydedilemez (zorunlu). */
  const [countDraft, setCountDraft] = useState('');
  const [scoreDraft, setScoreDraft] = useState('');
  const [countMsg, setCountMsg] = useState<string | null>(null);

  // TEK bir yerden, DEGISIM SONRASI (commit edilmis state ile) yazilir.
  // Onceki surum her setter'in KENDI ICINDE ayrica sessionStorage'a yaziyordu;
  // bir tikta setOpenExercises+setOpenMode+setEditingExercise ARKA ARKAYA
  // cagrilinca her cagri BIR ONCEKI (henuz commit edilmemis) state'i okuyup
  // uzerine yaziyordu — son yazan STALE degeri kaydedip pozisyonu bir adim
  // GERI dusuruyordu (F5'te yanlis sekmede acilma). useEffect her zaman
  // COMMIT EDILMIS son degerleri gorur, bu yuzden asla stale okumaz.
  useEffect(() => {
    try {
      sessionStorage.setItem(uiKey, JSON.stringify({ openExercises, openMode, editingExercise }));
    } catch { /* kota dolu olabilir */ }
  }, [uiKey, openExercises, openMode, editingExercise]);

  const refresh = useCallback(async () => {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${lessonId}/steps`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) setSteps(await r.json());
    setLoading(false);
  }, [lessonId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function addExplanation() {
    if (!expTitle.trim() && !expBody.trim()) { setMsg('Başlık veya metin gerekli'); return; }
    setBusy(true); setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${lessonId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        type: 'explanation',
        content_json: { title: expTitle.trim(), body: expBody.trim() },
      }),
    });
    if (!r.ok) { setMsg('Alt konu eklenemedi'); setBusy(false); return; }
    setExpTitle(''); setExpBody('');
    await refresh();
    setMsg('Alt konu eklendi');
    setBusy(false);
  }

  async function addQuiz() {
    const opts = qOptions.map((o) => o.trim()).filter((o) => o.length > 0);
    if (!qPrompt.trim() || opts.length < 2) { setMsg('Soru ve en az 2 şık gerekli'); return; }
    if (qCorrect >= opts.length) { setMsg('Doğru şık seçimi geçersiz'); return; }
    setBusy(true); setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${lessonId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        type: 'quiz',
        content_json: { questions: [{ prompt: qPrompt.trim(), options: opts, correct_index: qCorrect }] },
      }),
    });
    if (!r.ok) { setMsg('Soru eklenemedi'); setBusy(false); return; }
    setQPrompt(''); setQOptions(['', '']); setQCorrect(0);
    await refresh();
    setMsg('Soru eklendi');
    setBusy(false);
  }

  async function deleteStep(s: StepRow) {
    if (!confirm('Bu adımı silmek istiyor musun? Adıma ait çocuk deneme kayıtları da silinir.')) return;
    setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/steps/${s.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) { setMsg('Silinemedi'); return; }
    const d = await r.json();
    await refresh();
    setMsg(`Adım silindi (${d.results_deleted} deneme kaydı da silindi)`);
  }

  async function move(s: StepRow, dir: -1 | 1) {
    const idx = steps.findIndex((x) => x.id === s.id);
    const target = idx + dir;
    if (target < 0 || target >= steps.length) return;
    const ids = steps.map((x) => x.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/lessons/${lessonId}/steps/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ordered_ids: ids }),
    });
    if (!r.ok) { setMsg('Sıralanamadı'); return; }
    await refresh();
  }

  function exercisesOf(s: StepRow, field: string): BoardExercise[] {
    return (s.content_json[field] as BoardExercise[]) || [];
  }

  function totalExercises(s: StepRow): number {
    return EX_MODES.reduce((n, m) => n + exercisesOf(s, m.field).length, 0);
  }

  function questionCountOf(s: StepRow, field: string): number | undefined {
    const counts = s.content_json.question_counts as Record<string, number> | undefined;
    return counts?.[field];
  }

  function successScoreOf(s: StepRow, field: string): number | undefined {
    const scores = s.content_json.success_scores as Record<string, number> | undefined;
    return scores?.[field];
  }

  /**
   * Soru Sayısı ve Başarı Puanı BİRLİKTE, zorunlu olarak kaydedilir — biri
   * boşsa hiçbiri kaydedilmez (kullanıcı kararı: her ikisi de girilmeden bu
   * mod sporcuya eksik ayarla açılmasın).
   */
  async function saveQuestionCountAndScore(s: StepRow, field: string, countRaw: string, scoreRaw: string) {
    setCountMsg(null);
    const countTrimmed = countRaw.trim();
    const scoreTrimmed = scoreRaw.trim();
    if (!countTrimmed || !scoreTrimmed) {
      setCountMsg('Soru Sayısı Belirle ve Başarı Puanı Belirle — ikisi de girilmeli');
      return;
    }
    const countValue = Number(countTrimmed);
    if (!Number.isInteger(countValue) || countValue < 1) {
      setCountMsg('Soru sayısı 1 veya daha büyük bir tam sayı olmalı');
      return;
    }
    const poolSize = exercisesOf(s, field).length;
    if (countValue > poolSize) {
      setCountMsg(`Soru sayısı havuzdaki soru sayısından (${poolSize}) fazla olamaz`);
      return;
    }
    const scoreValue = Number(scoreTrimmed);
    if (!Number.isInteger(scoreValue) || scoreValue < 1 || scoreValue > 100) {
      setCountMsg('Başarı puanı 1-100 arasında bir tam sayı olmalı');
      return;
    }
    const counts = { ...(s.content_json.question_counts as Record<string, number> | undefined), [field]: countValue };
    const scores = { ...(s.content_json.success_scores as Record<string, number> | undefined), [field]: scoreValue };
    await saveQuestionCountAndScorePatch(s, counts, scores);
  }

  async function saveQuestionCountAndScorePatch(
    s: StepRow, counts: Record<string, number>, scores: Record<string, number>,
  ) {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/steps/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        content_json: { ...s.content_json, question_counts: counts, success_scores: scores },
      }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setCountMsg(typeof d.detail === 'string' ? d.detail : 'Kaydedilemedi');
      return;
    }
    await refresh();
    setMsg('Kaydedildi ✓');
  }

  async function saveExercises(s: StepRow, field: string, list: BoardExercise[]) {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/steps/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content_json: { ...s.content_json, [field]: list } }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(typeof d.detail === 'string' ? d.detail : 'Kaydedilemedi');
    }
    await refresh();
  }

  async function addExercise(s: StepRow, field: string, ex: BoardExercise) {
    setMsg(null);
    try {
      const list = exercisesOf(s, field);
      const coded: BoardExercise = { ...ex, code: nextExerciseCode(list) };
      await saveExercises(s, field, [...list, coded]);
      setMsg(`Soru eklendi (Kod: ${coded.code})`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Kaydedilemedi');
      throw e;
    }
  }

  async function updateExercise(s: StepRow, field: string, idx: number, ex: BoardExercise) {
    setMsg(null);
    try {
      const list = exercisesOf(s, field);
      // Eski sorularda kod yoksa düzenlerken kalıcı kod atanır (bir kez, o andan sonra sabit kalır).
      const coded: BoardExercise = { ...ex, code: ex.code ?? assignExerciseCodes(list)[idx] };
      const next = list.map((x, i) => (i === idx ? coded : x));
      await saveExercises(s, field, next);
      setMsg('Soru güncellendi');
      setEditingExercise(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Kaydedilemedi');
      throw e;
    }
  }

  async function moveExercise(s: StepRow, field: string, idx: number, dir: -1 | 1) {
    const list = exercisesOf(s, field);
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[idx], next[target]] = [next[target], next[idx]];
    setMsg(null);
    try {
      await saveExercises(s, field, next);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Sıralanamadı');
    }
  }

  async function deleteExercise(s: StepRow, field: string, idx: number) {
    if (!confirm('Bu soruyu silmek istiyor musun?')) return;
    setMsg(null);
    try {
      await saveExercises(s, field, exercisesOf(s, field).filter((_, i) => i !== idx));
      if (editingExercise?.stepId === s.id && editingExercise.field === field && editingExercise.idx === idx) setEditingExercise(null);
      setMsg('Soru silindi');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Silinemedi');
    }
  }

  function stepSummary(s: StepRow): string {
    if (s.type === 'explanation') {
      const t = (s.content_json.title as string) || '';
      const b = (s.content_json.body as string) || '';
      return t || b.slice(0, 60) || '(boş)';
    }
    if (s.type === 'quiz') {
      const qs = (s.content_json.questions as QuizQuestion[]) || [];
      return qs.length ? `${qs.length} soru · ${qs[0].prompt}` : '(soru yok)';
    }
    return s.type;
  }

  async function renameStepTitle(s: StepRow, title: string): Promise<boolean> {
    const token = getToken();
    try {
      const r = await fetch(`${API_BASE}/admin/steps/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content_json: { ...s.content_json, title } }),
      });
      if (!r.ok) return false;
      await refresh();
      return true;
    } catch {
      return false;
    }
  }

  if (loading) return <p className="n-muted">Yükleniyor...</p>;

  const accents = ['neon-cyan', 'neon-purple', 'neon-green', 'neon-amber', 'neon-blue', 'neon-pink'];

  return (
    <div className="max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-cyan-400 hover:text-cyan-300 mb-4">← Geri</button>
      <h1 className="text-2xl font-bold mb-4 n-text">Ders İçeriği</h1>
      {msg && <p className="text-sm n-muted mb-3">{msg}</p>}

      {steps.length === 0 ? (
        <p className="n-muted mb-6">Bu derste henüz içerik yok. Aşağıdan ekle.</p>
      ) : (
        <div className="grid gap-3 mb-8">
          {steps.map((s, i) => {
            const accent = accents[i % accents.length];
            return (
              <div key={s.id}>
                <div className={`neon-card ${accent} flex flex-wrap items-center gap-3 p-4`}>
                  <span className={`neon-avatar ${accent} w-10 h-10 text-xs shrink-0`}>{s.order_index}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs n-muted uppercase tracking-wide">
                      {s.type === 'explanation' ? 'Alt Konu' : s.type === 'quiz' ? 'Soru' : s.type}
                    </p>
                    {s.type === 'explanation' ? (
                      <InlineTitleEdit
                        value={stepSummary(s)}
                        onSave={(next) => renameStepTitle(s, next)}
                        ariaLabel={`${stepSummary(s)} başlığını düzenle`}
                        textClassName="font-semibold n-text truncate"
                      />
                    ) : (
                      <p className="font-semibold n-text truncate">{stepSummary(s)}</p>
                    )}
                  </div>
                  {s.type === 'explanation' && (
                    <button onClick={() => { setOpenExercises(openExercises === s.id ? null : s.id); setOpenMode(null); setEditingExercise(null); }}
                      className="px-3 py-1.5 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 text-xs transition-colors">
                      Sorular ({totalExercises(s)})
                    </button>
                  )}
                  <button onClick={() => move(s, -1)} disabled={i === 0}
                    aria-label="Yukarı taşı"
                    className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↑</button>
                  <button onClick={() => move(s, 1)} disabled={i === steps.length - 1}
                    aria-label="Aşağı taşı"
                    className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↓</button>
                  <button onClick={() => deleteStep(s)}
                    className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs transition-colors">Sil</button>
                </div>

                {openExercises === s.id && (
                  <div className="mt-3 ml-6 space-y-3">
                    {/* 3 pratik modu kartı — Hızlı Erişim ile uyumlu renkli tasarım */}
                    <div className="grid sm:grid-cols-3 gap-2">
                      {EX_MODES.map((m) => {
                        const count = exercisesOf(s, m.field).length;
                        const active = openMode?.stepId === s.id && openMode.field === m.field;
                        return (
                          <button
                            key={m.field}
                            onClick={() => {
                              setOpenMode(active ? null : { stepId: s.id, field: m.field });
                              setEditingExercise(null);
                              setCountMsg(null);
                              setCountDraft(active ? '' : String(questionCountOf(s, m.field) ?? ''));
                              setScoreDraft(active ? '' : String(successScoreOf(s, m.field) ?? ''));
                            }}
                            className="rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-1 border transition-all"
                            style={{
                              borderColor: m.color,
                              background: active ? `color-mix(in srgb, ${m.color} 14%, transparent)` : 'transparent',
                              boxShadow: active ? `0 0 22px -4px ${m.color}, inset 0 0 0 1px ${m.color}` : `0 0 16px -8px ${m.color}`,
                            }}
                          >
                            <span className="text-2xl leading-none">{m.emoji}</span>
                            <span className="font-semibold text-sm" style={{ color: m.color }}>{m.label}</span>
                            <span className="text-xs n-muted">{count} soru</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Seçili modun soru ekleme bölümü */}
                    {openMode?.stepId === s.id && (() => {
                      const mode = EX_MODES.find((m) => m.field === openMode.field)!;
                      const list = exercisesOf(s, mode.field);
                      const codes = assignExerciseCodes(list);
                      return (
                        <div className="space-y-3 pl-2 border-l-2 border-cyan-400/30">
                          <p className="text-sm font-bold n-text pl-2">{mode.emoji} {mode.label}</p>

                          <div className="pl-2 flex items-center gap-2 flex-wrap">
                            <label className="text-xs n-muted" htmlFor={`count-${s.id}-${mode.field}`}>
                              Soru Sayısını Belirle
                            </label>
                            <input
                              id={`count-${s.id}-${mode.field}`}
                              type="number"
                              min={1}
                              value={countDraft}
                              onChange={(e) => setCountDraft(e.target.value)}
                              placeholder="zorunlu"
                              className="neon-input text-sm"
                              style={{ width: 100 }}
                            />
                            <label className="text-xs n-muted" htmlFor={`score-${s.id}-${mode.field}`}>
                              Başarı Puanı Belirle
                            </label>
                            <input
                              id={`score-${s.id}-${mode.field}`}
                              type="number"
                              min={1}
                              max={100}
                              value={scoreDraft}
                              onChange={(e) => setScoreDraft(e.target.value)}
                              placeholder="zorunlu"
                              className="neon-input text-sm"
                              style={{ width: 100 }}
                            />
                            <button type="button"
                              onClick={() => saveQuestionCountAndScore(s, mode.field, countDraft, scoreDraft)}
                              className="px-3 py-1.5 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-xs transition-colors">
                              Kaydet
                            </button>
                          </div>
                          {countMsg && <p className="text-xs text-rose-400 pl-2">{countMsg}</p>}
                          {(() => {
                            const savedCount = questionCountOf(s, mode.field);
                            const poolSize = list.length;
                            return savedCount !== undefined && savedCount > poolSize ? (
                              <p className="text-xs pl-2" style={{ color: '#facc15' }}>
                                Belirlediğin sayı ({savedCount}) havuzdaki soru sayısından ({poolSize}) fazla —
                                sporcuya {poolSize} soru sorulacak.
                              </p>
                            ) : null;
                          })()}

                          {list.length === 0 ? (
                            <p className="text-sm n-muted pl-2">Bu modda henüz soru yok.</p>
                          ) : (
                            <div className="pl-2">
                              <CollapsibleCard
                                title={`${mode.label} Soru Havuzu`}
                                badge={`${list.length} soru`}
                                accentColor={mode.color}
                                forceOpen={editingExercise?.stepId === s.id && editingExercise.field === mode.field}
                              >
                              {/* Soru kodları — dairesel kartlar. Bir koda tıklayınca o soru düzenlenir. */}
                              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
                                {list.map((ex, idx) => {
                                  const editingThis = editingExercise?.stepId === s.id
                                    && editingExercise.field === mode.field && editingExercise.idx === idx;
                                  const circleColor = mode.field === 'board_exercises'
                                    ? difficultyColor((ex as { difficulty?: number }).difficulty ?? 1)
                                    : mode.color;
                                  return (
                                    <button
                                      key={idx}
                                      title={exerciseBadgeTitle(ex)}
                                      onClick={() => setEditingExercise(editingThis ? null : { stepId: s.id, field: mode.field, idx })}
                                      className="aspect-square rounded-full flex items-center justify-center font-mono font-bold transition-all"
                                      style={{
                                        fontSize: '0.85rem',
                                        border: `1.5px solid ${circleColor}`,
                                        background: editingThis ? circleColor : `color-mix(in srgb, ${circleColor} 12%, transparent)`,
                                        color: editingThis ? '#0b0f1a' : circleColor,
                                        boxShadow: editingThis ? `0 0 12px -2px ${circleColor}` : 'none',
                                      }}
                                    >
                                      {codes[idx]}
                                    </button>
                                  );
                                })}
                              </div>
                              </CollapsibleCard>
                            </div>
                          )}
                          <div className="pl-2">
                            {editingExercise?.stepId === s.id && editingExercise.field === mode.field ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <button onClick={() => moveExercise(s, mode.field, editingExercise.idx, -1)} disabled={editingExercise.idx === 0}
                                    aria-label="Soruyu yukarı taşı"
                                    className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↑ Sırayı yukarı al</button>
                                  <button onClick={() => moveExercise(s, mode.field, editingExercise.idx, 1)} disabled={editingExercise.idx === list.length - 1}
                                    aria-label="Soruyu aşağı taşı"
                                    className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↓ Sırayı aşağı al</button>
                                  <button onClick={() => deleteExercise(s, mode.field, editingExercise.idx)}
                                    className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">Soruyu sil</button>
                                </div>
                                <ExerciseForm
                                  key={`edit-${s.id}-${mode.field}-${editingExercise.idx}`}
                                  initial={{ ...list[editingExercise.idx], code: codes[editingExercise.idx] }}
                                  onSubmit={(ex) => updateExercise(s, mode.field, editingExercise.idx, ex)}
                                  onCancel={() => setEditingExercise(null)}
                                />
                              </div>
                            ) : (
                              <ExerciseForm key={`add-${s.id}-${mode.field}`} onSubmit={(ex) => addExercise(s, mode.field, ex)} />
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="neon-card neon-cyan p-5 mb-4">
        <h2 className="font-bold mb-3 n-text">Alt Konu ekle</h2>
        <input value={expTitle} onChange={(e) => setExpTitle(e.target.value)}
          placeholder="Başlık" className="neon-input mb-2" />
        <textarea value={expBody} onChange={(e) => setExpBody(e.target.value)}
          placeholder="Metin" rows={4} className="neon-input mb-3" />
        <button onClick={addExplanation} disabled={busy}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 text-sm transition-colors">
          Alt Konu ekle
        </button>
      </div>

      <div className="neon-card neon-purple p-5">
        <h2 className="font-bold mb-3 n-text">Soru ekle</h2>
        <input value={qPrompt} onChange={(e) => setQPrompt(e.target.value)}
          placeholder="Soru metni" className="neon-input mb-3" />
        <div className="space-y-2 mb-3">
          {qOptions.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={qCorrect === i}
                onChange={() => setQCorrect(i)}
                aria-label={`${i + 1}. şık doğru`}
                className="h-4 w-4 accent-cyan-400"
              />
              <input
                value={o}
                onChange={(e) => setQOptions(qOptions.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder={`${i + 1}. şık`}
                className="neon-input flex-1"
              />
              {qOptions.length > 2 && (
                <button onClick={() => {
                  const next = qOptions.filter((_, j) => j !== i);
                  setQOptions(next);
                  if (qCorrect >= next.length) setQCorrect(0);
                }}
                  className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">×</button>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setQOptions([...qOptions, ''])}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-xs transition-colors">
            + Şık ekle
          </button>
          <button onClick={addQuiz} disabled={busy}
            className="px-4 py-2 rounded-lg bg-purple-400/15 text-purple-200 border border-purple-400/50 hover:bg-purple-400/25 disabled:opacity-50 text-sm transition-colors">
            Soru ekle
          </button>
          <span className="text-xs n-muted">Doğru şıkkı soldaki yuvarlakla işaretle</span>
        </div>
      </div>
    </div>
  );
}
