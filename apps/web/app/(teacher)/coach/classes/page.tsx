'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { fetchMyClasses, createClass } from '@/lib/homeworkApi';
import type { TeacherClass } from '@/lib/homeworkApi';

/**
 * Madde 2026-09-13 (Sınıflarım — Madde 2): antrenörün "Çalışmalar"daki
 * "Sınıflarım" özel sekmesine (kind='siniflarim', bkz. SiniflarimKind
 * migration) tıklayınca gelinen AYRI sayfa. Sınıf oluşturur (join_code
 * sunucuda üretilir) ve mevcut sınıfları listeler; "Sınıf Listesi" o
 * sınıfın sporcularını gösteren [id] sayfasına götürür.
 */
export default function SiniflarimPage() {
  const router = useRouter();
  const { role, hydrated } = useAuth();

  const [classes, setClasses] = useState<TeacherClass[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated || role !== 'teacher') return;
    fetchMyClasses().then(setClasses);
  }, [hydrated, role]);

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
              <div key={c.id} className="flex items-center justify-between gap-2 py-2"
                style={{ borderBottom: i < classes.length - 1 ? '1px solid var(--t-border)' : undefined }}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold t-muted w-5 text-right">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{c.name}</p>
                    <p className="text-[11px] font-mono tracking-widest t-muted">{c.join_code}</p>
                  </div>
                </div>
                <button type="button" onClick={() => router.push(`/coach/classes/${c.id}`)}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold"
                  style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)' }}>
                  Sınıf Listesi
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button type="button" onClick={() => router.push('/coach')}
        className="text-sm t-muted underline">← Antrenör paneline dön</button>
    </main>
  );
}
