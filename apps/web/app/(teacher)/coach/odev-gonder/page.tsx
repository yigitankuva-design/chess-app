'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  fetchHomeworkTarget, fetchMyClasses, fetchClassStudents, sendHomework,
} from '@/lib/homeworkApi';
import type { HomeworkTarget, TeacherClass, ClassStudent } from '@/lib/homeworkApi';

/**
 * Madde 2026-09-11 (Ödev Sistemi Faz 3): Antrenör bir Alt Konu'yu anlatırken
 * "Ödev Gönder"e basınca gelinen AYRI sayfa. Akış (Zafer'in görseli):
 *   sınıf sekmeleri → öğrenci seçimi (+ "Tüm Sınıf") → otomatik Alt Konu
 *   kartı → Başlangıç/Bitiş Tarihi → Antrenör Notu → en altta gönder.
 * Ödev hedefi, anlatılan Alt Konu'nun MÜFREDAT karşılığıdır (Faz 2 köprüsü);
 * bağ yoksa gönderim yapılamaz.
 */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function OdevGonderPage() {
  return (
    <Suspense fallback={<main className="px-4 pt-6 pb-12 max-w-xl mx-auto"><p className="t-muted">Yükleniyor…</p></main>}>
      <OdevGonderInner />
    </Suspense>
  );
}

function OdevGonderInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { role, token } = useAuth();
  const sectionId = Number(params.get('section'));

  const [target, setTarget] = useState<HomeworkTarget | null | undefined>(undefined);
  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [activeClassId, setActiveClassId] = useState<number | null>(null);
  const [studentsByClass, setStudentsByClass] = useState<Record<number, ClassStudent[]>>({});

  /** "Tüm Sınıf" açık olan sınıflar. */
  const [fullClasses, setFullClasses] = useState<Set<number>>(new Set());
  /** Tek tek seçilen sporcular (bir "Tüm Sınıf"ta olmayanlar). */
  const [pickedChildren, setPickedChildren] = useState<Set<number>>(new Set());

  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    if (!token || role !== 'teacher') return;
    if (!sectionId) { setTarget(null); return; }
    fetchHomeworkTarget(sectionId).then(setTarget);
    fetchMyClasses().then((cs) => {
      setClasses(cs);
      if (cs.length > 0) setActiveClassId(cs[0].id);
    });
  }, [token, role, sectionId]);

  useEffect(() => {
    if (activeClassId == null || studentsByClass[activeClassId]) return;
    fetchClassStudents(activeClassId).then((s) =>
      setStudentsByClass((prev) => ({ ...prev, [activeClassId]: s })),
    );
  }, [activeClassId, studentsByClass]);

  const recipientCount = useMemo(() => {
    let n = 0;
    for (const cid of fullClasses) n += (studentsByClass[cid]?.length ?? 0);
    n += pickedChildren.size;
    return n;
  }, [fullClasses, pickedChildren, studentsByClass]);

  if (role !== 'teacher') {
    return <main className="px-4 pt-6 pb-12 max-w-xl mx-auto"><p className="t-muted">Bu sayfa yalnızca antrenörler içindir.</p></main>;
  }

  if (target === undefined) {
    return <main className="px-4 pt-6 pb-12 max-w-xl mx-auto"><p className="t-muted">Yükleniyor…</p></main>;
  }

  if (!target || !target.linked) {
    return (
      <main className="px-4 pt-6 pb-12 max-w-xl mx-auto space-y-4">
        <h1 className="text-xl font-extrabold t-premium">Ödev Gönder</h1>
        <div className="t-card p-4">
          <p className="text-sm" style={{ color: '#f43f5e' }}>
            {target?.section_title
              ? `"${target.section_title}" alt konusu müfredata bağlı değil.`
              : 'Alt konu bulunamadı.'}
          </p>
          <p className="text-xs t-muted mt-1">
            Yönetici panelinden (Sekmeler › Çalışmalar › Dersler › Alt Konu › Müfredat Köprüsü)
            bu alt konu bir ders adımına bağlanmalı.
          </p>
        </div>
        <button type="button" onClick={() => router.back()}
          className="text-sm t-muted underline">← Geri dön</button>
      </main>
    );
  }

  function toggleFullClass(classId: number) {
    setFullClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else {
        next.add(classId);
        // Bu sınıfın tek tek seçimlerini temizle (hepsi kapsandı).
        const ids = new Set((studentsByClass[classId] ?? []).map((s) => s.id));
        setPickedChildren((pc) => new Set([...pc].filter((id) => !ids.has(id))));
      }
      return next;
    });
  }

  function toggleChild(classId: number, childId: number) {
    if (fullClasses.has(classId)) return; // "Tüm Sınıf" açıkken tek seçim kilitli
    setPickedChildren((prev) => {
      const next = new Set(prev);
      if (next.has(childId)) next.delete(childId);
      else next.add(childId);
      return next;
    });
  }

  async function submit() {
    setErr(null);
    if (recipientCount === 0) { setErr('En az bir sporcu seç.'); return; }
    if (endDate && endDate < startDate) { setErr('Bitiş tarihi başlangıçtan önce olamaz.'); return; }
    setBusy(true);
    const res = await sendHomework({
      lesson_step_id: target!.lesson_step_id!,
      source_section_id: sectionId,
      class_ids: [...fullClasses],
      child_ids: [...pickedChildren],
      start_date: startDate,
      end_date: endDate || null,
      note: note.trim() || null,
    });
    setBusy(false);
    if (!res) { setErr('Ödev gönderilemedi.'); return; }
    setDone(res.recipient_count);
  }

  if (done != null) {
    return (
      <main className="px-4 pt-6 pb-12 max-w-xl mx-auto space-y-4">
        <h1 className="text-xl font-extrabold t-premium">Ödev Gönderildi</h1>
        <div className="t-card p-4">
          <p className="text-sm">
            <b>{target.duzey_title} › {target.konu_title} › {target.alt_konu_title}</b> ödevi
            {' '}<b>{done}</b> sporcuya gönderildi.
          </p>
          <p className="text-xs t-muted mt-1">
            Sporcular {startDate} tarihinden itibaren &quot;Bildirimler&quot; sekmesinde görecek.
          </p>
        </div>
        <button type="button" onClick={() => router.push('/coach')}
          className="rounded-xl px-4 py-2 text-sm font-bold"
          style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
          Antrenör paneline dön
        </button>
      </main>
    );
  }

  const activeStudents = activeClassId != null ? studentsByClass[activeClassId] : undefined;

  return (
    <main className="px-4 pt-6 pb-12 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-extrabold t-premium">Ödev Gönder</h1>

      {/* Otomatik Alt Konu kartı */}
      <div className="t-card p-4">
        <p className="text-xs font-bold uppercase tracking-widest t-muted mb-1">Gönderilecek Alt Konu</p>
        <p className="text-sm font-semibold">{target.alt_konu_title}</p>
        <p className="text-xs t-muted">{target.duzey_title} › {target.konu_title}</p>
      </div>

      {/* Sınıf sekmeleri + öğrenci seçimi */}
      <div className="t-card p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest t-muted">Kime Gönderilecek</p>
        {classes === null ? (
          <p className="text-xs t-muted">Sınıflar yükleniyor…</p>
        ) : classes.length === 0 ? (
          <p className="text-xs t-muted">Henüz sınıfın yok. Önce bir sınıf oluştur.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {classes.map((c) => {
                const active = c.id === activeClassId;
                const n = (fullClasses.has(c.id) ? (studentsByClass[c.id]?.length ?? 0) : 0)
                  + (studentsByClass[c.id] ?? []).filter((s) => pickedChildren.has(s.id)).length;
                return (
                  <button key={c.id} type="button" onClick={() => setActiveClassId(c.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                    style={{
                      background: active ? 'var(--t-accent)' : 'var(--t-surface-2)',
                      color: active ? 'var(--t-accent-fg)' : 'var(--t-text-2)',
                    }}>
                    {c.name}{n > 0 ? ` (${n})` : ''}
                  </button>
                );
              })}
            </div>

            {activeClassId != null && (
              <div className="space-y-1.5 pt-1">
                {activeStudents === undefined ? (
                  <p className="text-xs t-muted">Öğrenciler yükleniyor…</p>
                ) : activeStudents.length === 0 ? (
                  <p className="text-xs t-muted">Bu sınıfta öğrenci yok.</p>
                ) : (
                  <>
                    <label className="flex items-center gap-2 py-1 text-sm font-semibold cursor-pointer">
                      <input type="checkbox" className="h-4 w-4"
                        style={{ accentColor: 'var(--t-accent)' }}
                        checked={fullClasses.has(activeClassId)}
                        onChange={() => toggleFullClass(activeClassId)} />
                      Tüm Sınıf
                    </label>
                    <div className="pl-1 border-l" style={{ borderColor: 'var(--t-border)' }}>
                      {activeStudents.map((s) => {
                        const inFull = fullClasses.has(activeClassId);
                        const checked = inFull || pickedChildren.has(s.id);
                        return (
                          <label key={s.id}
                            className="flex items-center gap-2 py-1 pl-2 text-sm cursor-pointer"
                            style={{ opacity: inFull ? 0.6 : 1 }}>
                            <input type="checkbox" className="h-4 w-4"
                              style={{ accentColor: 'var(--t-accent)' }}
                              checked={checked} disabled={inFull}
                              onChange={() => toggleChild(activeClassId, s.id)} />
                            {s.display_name}
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
        {recipientCount > 0 && (
          <p className="text-xs t-muted">Toplam <b>{recipientCount}</b> sporcu seçildi.</p>
        )}
      </div>

      {/* Tarihler */}
      <div className="t-card p-4 space-y-3">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest t-muted block mb-1">
            Başlangıç Tarihi
          </label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm w-full"
            style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }} />
          <p className="text-[11px] t-muted mt-1">Ödev bu tarihten itibaren sporcunun &quot;Bildirimler&quot; sekmesinde görünür.</p>
        </div>
        <div>
          <label className="text-xs font-bold uppercase tracking-widest t-muted block mb-1">
            Bitiş Tarihi (opsiyonel)
          </label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm w-full"
            style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }} />
          <p className="text-[11px] t-muted mt-1">Son teslim tarihi; geçse de sporcu ödevini yapabilir.</p>
        </div>
      </div>

      {/* Not */}
      <div className="t-card p-4">
        <label className="text-xs font-bold uppercase tracking-widest t-muted block mb-1">
          Antrenör Notu (opsiyonel)
        </label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder="Sporcuya iletmek istediğin not…"
          className="rounded-lg px-3 py-2 text-sm w-full"
          style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }} />
      </div>

      {err && <p className="text-sm" style={{ color: '#f43f5e' }}>{err}</p>}

      <button type="button" onClick={submit} disabled={busy || recipientCount === 0}
        className="w-full rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-40"
        style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
        {busy ? 'Gönderiliyor…' : `Ödevi Gönder${recipientCount > 0 ? ` (${recipientCount})` : ''}`}
      </button>
    </main>
  );
}
