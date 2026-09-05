'use client';
import { useEffect, useState } from 'react';
import {
  listMyClasses, searchStudents, listAdminModules, listAdminModuleLessons,
  createClassAssignment, createIndividualAssignment,
} from '@/lib/assignmentsApi';
import type { TeacherClass, StudentSearchResult, AdminModuleSummary, AdminLessonSummary } from '@/lib/assignmentsApi';

type Hedef = 'class' | 'student';

interface Props {
  /** Bu ödevin Antrenör'de HANGİ Alt Konu anlatılırken verildiği — ödevle
   *  birlikte kaydedilir (izlenebilirlik). */
  sourceSectionId: number;
  sourceSectionTitle: string;
}

/**
 * Madde 2026-09-05: Antrenör → Ödev → Dersler köprüsü. Zafer bu Alt Konu'yu
 * anlattıktan sonra, Dersler müfredatından bir modül/ders seçip sınıfa veya
 * tek bir sporcuya ödev olarak verebilir. Varsayılan KAPALI — "📌 Ödev
 * Olarak Ver" ile açılır, diğer akordiyonlarla AYNI desen.
 */
export function AssignHomeworkPanel({ sourceSectionId, sourceSectionTitle }: Props) {
  const [open, setOpen] = useState(false);
  const [hedef, setHedef] = useState<Hedef>('class');

  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);

  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  const [modules, setModules] = useState<AdminModuleSummary[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [lessons, setLessons] = useState<AdminLessonSummary[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    listMyClasses().then(setClasses);
    listAdminModules().then(setModules);
  }, [open]);

  useEffect(() => {
    if (selectedModuleId === null) { setLessons([]); setSelectedLessonId(null); return; }
    setSelectedLessonId(null);
    listAdminModuleLessons(selectedModuleId).then(setLessons);
  }, [selectedModuleId]);

  async function doSearch() {
    if (!studentQuery.trim()) return;
    setSearching(true);
    const results = await searchStudents(studentQuery.trim());
    setSearching(false);
    setStudentResults(results);
  }

  function resetForm() {
    setSelectedClassId(null); setSelectedStudent(null); setStudentQuery(''); setStudentResults([]);
    setSelectedModuleId(null); setSelectedLessonId(null);
    setTitle(''); setDueDate(''); setDescription('');
  }

  const canSubmit = title.trim().length > 0 && selectedModuleId !== null
    && (hedef === 'class' ? selectedClassId !== null : selectedStudent !== null);

  async function submit() {
    if (!canSubmit || selectedModuleId === null) return;
    setBusy(true); setErr(null);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      target_module_id: selectedModuleId,
      target_lesson_id: selectedLessonId,
      due_date: dueDate || null,
      source_custom_tab_section_id: sourceSectionId,
    };
    const result = hedef === 'class' && selectedClassId !== null
      ? await createClassAssignment(selectedClassId, payload)
      : selectedStudent
        ? await createIndividualAssignment(selectedStudent.id, payload)
        : null;
    setBusy(false);
    if (!result) { setErr('Ödev verilemedi'); return; }
    resetForm();
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  }

  const pill = (active: boolean) => ({
    border: active ? '2px solid var(--t-accent, rgb(34 211 238))' : '1px solid rgba(255,255,255,0.15)',
    background: active ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.03)',
    color: active ? 'rgb(103 232 249)' : 'rgba(255,255,255,0.8)',
  }) as const;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] mt-2">
      <button type="button" onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-colors">
        <span className="text-sm font-semibold n-text flex-1">📌 Ödev Olarak Ver</span>
        <span className="text-xs n-muted">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/10 pt-3">
          <p className="text-xs n-muted">
            &quot;{sourceSectionTitle}&quot; ile ilgili Dersler&apos;den bir modül/ders seçip
            sınıfa veya tek bir sporcuya ödev olarak ver.
          </p>

          {success && <p className="text-emerald-300 text-xs">✅ Ödev verildi.</p>}

          {/* Hedef kitle */}
          <div className="flex gap-2">
            <button type="button" style={pill(hedef === 'class')} onClick={() => setHedef('class')}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
              Sınıf
            </button>
            <button type="button" style={pill(hedef === 'student')} onClick={() => setHedef('student')}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
              Tek Öğrenci
            </button>
          </div>

          {hedef === 'class' ? (
            classes.length === 0 ? (
              <p className="text-xs n-muted">Henüz bir sınıfın yok — önce Sınıflarım&apos;dan oluştur.</p>
            ) : (
              <select value={selectedClassId ?? ''} onChange={(e) => setSelectedClassId(e.target.value ? Number(e.target.value) : null)}
                className="neon-input text-sm" aria-label="Hedef sınıf">
                <option value="">Sınıf seç…</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={studentQuery} onChange={(e) => setStudentQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                  placeholder="Öğrenci adı ara…" className="neon-input text-sm flex-1" />
                <button type="button" onClick={doSearch} disabled={searching || !studentQuery.trim()}
                  className="px-3 py-1.5 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-xs transition-colors">
                  {searching ? '…' : 'Ara'}
                </button>
              </div>
              {studentResults.length > 0 && (
                <div className="space-y-1">
                  {studentResults.map((s) => (
                    <button key={s.id} type="button" onClick={() => setSelectedStudent(s)}
                      style={pill(selectedStudent?.id === s.id)}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors">
                      {s.display_name}
                    </button>
                  ))}
                </div>
              )}
              {selectedStudent && (
                <p className="text-xs text-cyan-300">Seçili: {selectedStudent.display_name}</p>
              )}
            </div>
          )}

          {/* Hedef içerik */}
          <select value={selectedModuleId ?? ''} onChange={(e) => setSelectedModuleId(e.target.value ? Number(e.target.value) : null)}
            className="neon-input text-sm" aria-label="Hedef modül">
            <option value="">Modül seç…</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          {selectedModuleId !== null && lessons.length > 0 && (
            <select value={selectedLessonId ?? ''} onChange={(e) => setSelectedLessonId(e.target.value ? Number(e.target.value) : null)}
              className="neon-input text-sm" aria-label="Hedef ders (opsiyonel)">
              <option value="">Tüm modül</option>
              {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          )}

          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Ödev başlığı" className="neon-input text-sm" />
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
            className="neon-input text-sm" aria-label="Son tarih (opsiyonel)" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Not (opsiyonel)" rows={2} className="neon-input text-sm" />

          {err && <p className="text-rose-400 text-xs">{err}</p>}

          <button type="button" onClick={submit} disabled={busy || !canSubmit}
            className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-sm transition-colors">
            Ödevi Ver
          </button>
        </div>
      )}
    </div>
  );
}
