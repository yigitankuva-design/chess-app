'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { fetchMyClasses, createClass, renameClass, deleteClass, moveClass } from '@/lib/homeworkApi';
import type { TeacherClass } from '@/lib/homeworkApi';
import { EditButton, EditSheet } from '@/components/profile/ProfileEditors';

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 15l6-6 6 6" />
    </svg>
  );
}
function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Madde 2026-09-13 (Sınıflarım — Madde 2): antrenörün "Çalışmalar"daki
 * "Sınıflarım" özel sekmesine (kind='siniflarim', bkz. SiniflarimKind
 * migration) tıklayınca gelinen AYRI sayfa. Sınıf oluşturur (join_code
 * sunucuda üretilir) ve mevcut sınıfları listeler; "Sınıf Listesi" o
 * sınıfın sporcularını gösteren [id] sayfasına götürür.
 *
 * Madde 2026-09-13 (devam, yönetim özellikleri): isim düzeltme (kalem
 * ikonu → EditSheet, ProfileEditors.tsx'teki AYNI desen), ▲/▼ ile sıralama
 * (komşuyla order_index takası, sunucudan gelen liste sırası zaten
 * order_index'e göre), silme (confirm() ile "emin misin?" — admin/
 * settings/tabs/page.tsx'teki AYNI native-confirm deseni).
 */
export default function SiniflarimPage() {
  const router = useRouter();
  const { role, hydrated } = useAuth();

  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** İşlem sırasında olan sınıfın id'si — ▲/▼/Sil düğmelerini geçici kilitler. */
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameErr, setRenameErr] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || role !== 'teacher') return;
    fetchMyClasses().then(setClasses);
  }, [hydrated, role]);

  async function handleMove(classId: number, direction: 'up' | 'down') {
    if (!classes) return;
    const idx = classes.findIndex((c) => c.id === classId);
    const neighborIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || neighborIdx < 0 || neighborIdx >= classes.length) return;
    setActionBusyId(classId);
    const ok = await moveClass(classId, direction);
    setActionBusyId(null);
    if (!ok) return;
    setClasses((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      [next[idx], next[neighborIdx]] = [next[neighborIdx], next[idx]];
      return next;
    });
  }

  async function handleDelete(cls: TeacherClass) {
    if (!confirm(`"${cls.name}" sınıfını silmek istediğine emin misin? Bu işlem geri alınamaz.`)) return;
    setActionBusyId(cls.id);
    const ok = await deleteClass(cls.id);
    setActionBusyId(null);
    if (!ok) return;
    setClasses((prev) => (prev ? prev.filter((c) => c.id !== cls.id) : prev));
  }

  function startRename(cls: TeacherClass) {
    setRenameDraft(cls.name);
    setRenameErr(null);
    setRenamingId(cls.id);
  }

  async function saveRename() {
    if (renamingId == null) return;
    const trimmed = renameDraft.trim();
    if (!trimmed) { setRenameErr('Sınıf adı boş olamaz.'); return; }
    setRenameBusy(true);
    const updated = await renameClass(renamingId, trimmed);
    setRenameBusy(false);
    if (!updated) { setRenameErr('Kaydedilemedi, tekrar dene.'); return; }
    setClasses((prev) => (prev ? prev.map((c) => (c.id === renamingId ? { ...c, name: updated.name } : c)) : prev));
    setRenamingId(null);
  }

  if (!hydrated) return null;
  if (role !== 'teacher') {
    return <main className="px-4 pt-6 pb-12 max-w-xl mx-auto"><p className="t-muted">Bu sayfa yalnızca antrenörler içindir.</p></main>;
  }

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed) { setErr('Sınıf adı gerekli.'); return; }
    setErr(null);
    setBusy(true);
    const created = await createClass(trimmed);
    setBusy(false);
    if (!created) { setErr('Sınıf oluşturulamadı.'); return; }
    setClasses((prev) => [...(prev ?? []), created]);
    setName('');
  }

  return (
    <main className="px-4 pt-6 pb-12 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-extrabold t-premium">Sınıflarım</h1>

      {/* Yeni sınıf oluşturma satırı */}
      <div className="t-card p-4 space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest t-muted">Yeni Sınıf</p>
        <div className="flex gap-2">
          <input
            type="text" value={name} placeholder="Sınıf Adı"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            className="flex-1 rounded-lg px-3 py-2 text-sm"
            style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }}
          />
          <button type="button" onClick={submit} disabled={busy || !name.trim()}
            className="rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:opacity-40"
            style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
            {busy ? '...' : 'OLUŞTUR'}
          </button>
        </div>
        {err && <p className="text-sm" style={{ color: '#f43f5e' }}>{err}</p>}
      </div>

      {/* Mevcut sınıflar */}
      <div className="t-card p-4">
        <p className="text-xs font-bold uppercase tracking-widest t-muted mb-2">Mevcut Sınıflar</p>
        {classes === null ? (
          <p className="text-xs t-muted">Yükleniyor…</p>
        ) : classes.length === 0 ? (
          <p className="text-xs t-muted">Henüz sınıfın yok.</p>
        ) : (
          <div className="space-y-2">
            {classes.map((c, i) => (
              <div key={c.id} className="py-2"
                style={{ borderBottom: i < classes.length - 1 ? '1px solid var(--t-border)' : undefined }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold t-muted w-5 text-right">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{c.name}</p>
                    <p className="text-[11px] font-mono tracking-widest t-muted">{c.join_code}</p>
                  </div>
                  {/* Madde 2026-09-13: ▲/▼ ok sistemi — listenin başında/sonunda devre dışı. */}
                  <div className="flex flex-col shrink-0" style={{ color: 'var(--t-text-2)' }}>
                    <button type="button" onClick={() => handleMove(c.id, 'up')}
                      disabled={i === 0 || actionBusyId === c.id}
                      aria-label={`${c.name} yukarı taşı`}
                      className="p-0.5 disabled:opacity-25">
                      <ChevronUpIcon />
                    </button>
                    <button type="button" onClick={() => handleMove(c.id, 'down')}
                      disabled={i === classes.length - 1 || actionBusyId === c.id}
                      aria-label={`${c.name} aşağı taşı`}
                      className="p-0.5 disabled:opacity-25">
                      <ChevronDownIcon />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pl-8">
                  <EditButton onClick={() => startRename(c)} label={`${c.name} adını düzenle`} />
                  <button type="button" onClick={() => handleDelete(c)} disabled={actionBusyId === c.id}
                    className="px-2 py-1 rounded-md text-xs font-bold disabled:opacity-40"
                    style={{ color: '#f43f5e' }}>
                    Sil
                  </button>
                  <button type="button" onClick={() => router.push(`/coach/classes/${c.id}`)}
                    className="ml-auto shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold"
                    style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)' }}>
                    Sınıf Listesi
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={() => router.push('/coach')}
        className="text-sm t-muted underline">← Antrenör paneline dön</button>

      {renamingId != null && (
        <EditSheet title="Sınıf Adını Düzenle" busy={renameBusy} err={renameErr}
          onSave={saveRename} onCancel={() => setRenamingId(null)}>
          <label className="block text-[10px] font-bold uppercase tracking-wide t-muted">
            Sınıf Adı
            <input type="text" value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)}
              maxLength={80} autoFocus aria-label="Sınıf Adı"
              className="rounded-lg px-3 py-2 text-sm w-full mt-1"
              style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }} />
          </label>
        </EditSheet>
      )}
    </main>
  );
}
