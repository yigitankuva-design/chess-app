'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth-storage';
import { ExerciseForm } from '@/components/admin/ExerciseForm';
import type { BoardExercise } from '@/components/admin/ExerciseForm';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const EXERCISE_TYPE_LABELS: Record<string, string> = {
  click_square: 'Kareye tıkla',
  move_piece: 'Taşı oynat',
  identify_piece: 'Taşı tanı',
};

function exerciseTypeLabel(type: string): string {
  return EXERCISE_TYPE_LABELS[type] ?? type;
}

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

  const [openExercises, setOpenExercises] = useState<number | null>(null);
  const [editingExercise, setEditingExercise] = useState<{ stepId: number; idx: number } | null>(null);

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

  function exercisesOf(s: StepRow): BoardExercise[] {
    return (s.content_json.board_exercises as BoardExercise[]) || [];
  }

  async function saveExercises(s: StepRow, list: BoardExercise[]) {
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/steps/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content_json: { ...s.content_json, board_exercises: list } }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(typeof d.detail === 'string' ? d.detail : 'Kaydedilemedi');
    }
    await refresh();
  }

  async function addExercise(s: StepRow, ex: BoardExercise) {
    setMsg(null);
    try {
      await saveExercises(s, [...exercisesOf(s), ex]);
      setMsg('Soru eklendi');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Kaydedilemedi');
      throw e;
    }
  }

  async function updateExercise(s: StepRow, idx: number, ex: BoardExercise) {
    setMsg(null);
    try {
      const list = exercisesOf(s).map((x, i) => (i === idx ? ex : x));
      await saveExercises(s, list);
      setMsg('Soru güncellendi');
      setEditingExercise(null);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Kaydedilemedi');
      throw e;
    }
  }

  async function moveExercise(s: StepRow, idx: number, dir: -1 | 1) {
    const list = exercisesOf(s);
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[idx], next[target]] = [next[target], next[idx]];
    setMsg(null);
    try {
      await saveExercises(s, next);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Sıralanamadı');
    }
  }

  async function deleteExercise(s: StepRow, idx: number) {
    if (!confirm('Bu soruyu silmek istiyor musun?')) return;
    setMsg(null);
    try {
      await saveExercises(s, exercisesOf(s).filter((_, i) => i !== idx));
      if (editingExercise?.stepId === s.id && editingExercise.idx === idx) setEditingExercise(null);
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
                    <p className="font-semibold n-text truncate">{stepSummary(s)}</p>
                  </div>
                  {s.type === 'explanation' && (
                    <button onClick={() => setOpenExercises(openExercises === s.id ? null : s.id)}
                      className="px-3 py-1.5 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 text-xs transition-colors">
                      Sorular ({exercisesOf(s).length})
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
                    {exercisesOf(s).length === 0 ? (
                      <p className="text-sm n-muted">Bu adımda henüz soru yok.</p>
                    ) : (
                      <div className="grid gap-2">
                        {exercisesOf(s).map((ex, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10">
                            <span className="text-xs n-muted w-6">{idx + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs n-muted">
                                {exerciseTypeLabel(ex.type)}
                                {ex.difficulty ? ` · Zorluk ${ex.difficulty}/5` : ''}
                              </p>
                              <p className="text-sm n-text truncate">{ex.instruction}</p>
                            </div>
                            <button onClick={() => moveExercise(s, idx, -1)} disabled={idx === 0}
                              aria-label="Soruyu yukarı taşı"
                              className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↑</button>
                            <button onClick={() => moveExercise(s, idx, 1)} disabled={idx === exercisesOf(s).length - 1}
                              aria-label="Soruyu aşağı taşı"
                              className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↓</button>
                            <button onClick={() => setEditingExercise({ stepId: s.id, idx })}
                              className="px-2 py-1 rounded-md text-cyan-300 hover:bg-cyan-400/10 text-xs">Düzenle</button>
                            <button onClick={() => deleteExercise(s, idx)}
                              className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">Sil</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {editingExercise?.stepId === s.id ? (
                      <ExerciseForm
                        key={`edit-${s.id}-${editingExercise.idx}`}
                        initial={exercisesOf(s)[editingExercise.idx]}
                        onSubmit={(ex) => updateExercise(s, editingExercise.idx, ex)}
                        onCancel={() => setEditingExercise(null)}
                      />
                    ) : (
                      <ExerciseForm key={`add-${s.id}`} onSubmit={(ex) => addExercise(s, ex)} />
                    )}
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
