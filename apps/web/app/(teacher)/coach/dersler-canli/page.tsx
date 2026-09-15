'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { fetchMyClasses } from '@/lib/homeworkApi';
import type { TeacherClass } from '@/lib/homeworkApi';
import { fetchMyLiveLessons, createLiveLesson, startLiveLesson } from '@/lib/liveLessonsApi';
import type { LiveLesson, LiveLessonJoinMode } from '@/lib/liveLessonsApi';

/**
 * Madde 2026-09-15 (Online Dersler): antrenörün ders listesi + "Yeni Ders
 * Oluştur" formu (Zafer'in madde 1'i — tarih/saat/süre/sınıf). Oluşturulan
 * ders sınıftaki HER öğrenciye bildirim olarak düşer (backend fan-out,
 * bkz. routers/live_lessons.py). Ekran tasarımı `odev-gonder/page.tsx`
 * ile AYNI dil/bileşenler — detaylı görsel tasarım sonraya bırakıldı.
 */
function todayLocalISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_LABEL: Record<LiveLesson['status'], string> = {
  scheduled: 'Planlandı', live: 'Şimdi Canlı', ended: 'Bitti',
};

export default function DerslerCanliPage() {
  const router = useRouter();
  const { role, token } = useAuth();

  const [lessons, setLessons] = useState<LiveLesson[] | null>(null);
  const [classes, setClasses] = useState<TeacherClass[] | null>(null);

  const [classId, setClassId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState(todayLocalISO());
  const [duration, setDuration] = useState(45);
  const [joinMode, setJoinMode] = useState<LiveLessonJoinMode>('auto');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token || role !== 'teacher') return;
    fetchMyLiveLessons().then(setLessons);
    fetchMyClasses().then((cs) => {
      setClasses(cs);
      if (cs.length > 0) setClassId(cs[0].id);
    });
  }, [token, role]);

  if (role !== 'teacher') {
    return <main className="px-4 pt-6 pb-12 max-w-xl mx-auto"><p className="t-muted">Bu sayfa yalnızca antrenörler içindir.</p></main>;
  }

  async function submit() {
    setErr(null);
    if (!classId) { setErr('Bir sınıf seç.'); return; }
    if (!title.trim()) { setErr('Ders başlığı gir.'); return; }
    setBusy(true);
    const created = await createLiveLesson({
      class_id: classId, title: title.trim(),
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: duration, join_mode: joinMode,
    });
    setBusy(false);
    if (!created) { setErr('Ders oluşturulamadı.'); return; }
    setLessons((prev) => [created, ...(prev ?? [])]);
    setTitle('');
  }

  async function handleStart(lessonId: number) {
    const info = await startLiveLesson(lessonId);
    if (!info) { setErr('Ders başlatılamadı.'); return; }
    router.push(`/coach/dersler-canli/${lessonId}`);
  }

  return (
    <main className="px-4 pt-6 pb-12 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-extrabold t-premium">Online Dersler</h1>

      <div className="t-card p-4 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest t-muted">Yeni Ders Oluştur</p>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest t-muted block mb-1">Sınıf</label>
          {classes === null ? (
            <p className="text-xs t-muted">Sınıflar yükleniyor…</p>
          ) : classes.length === 0 ? (
            <p className="text-xs t-muted">Henüz sınıfın yok. Önce bir sınıf oluştur.</p>
          ) : (
            <select value={classId} onChange={(e) => setClassId(Number(e.target.value))}
              className="rounded-lg px-3 py-2 text-sm w-full"
              style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }}>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest t-muted block mb-1">Ders Başlığı</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Örn. Açılış Dersi"
            className="rounded-lg px-3 py-2 text-sm w-full"
            style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }} />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest t-muted block mb-1">Tarih ve Saat</label>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm w-full"
            style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }} />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest t-muted block mb-1">Süre (dakika)</label>
          <input type="number" min={5} max={240} value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="rounded-lg px-3 py-2 text-sm w-full"
            style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }} />
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest t-muted block mb-1">Katılım</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setJoinMode('auto')}
              className="flex-1 rounded-lg px-3 py-2 text-xs font-bold"
              style={{
                background: joinMode === 'auto' ? 'var(--t-accent)' : 'var(--t-surface-2)',
                color: joinMode === 'auto' ? 'var(--t-accent-fg)' : 'var(--t-text-2)',
              }}>
              Otomatik Katılım
            </button>
            <button type="button" onClick={() => setJoinMode('approval')}
              className="flex-1 rounded-lg px-3 py-2 text-xs font-bold"
              style={{
                background: joinMode === 'approval' ? 'var(--t-accent)' : 'var(--t-surface-2)',
                color: joinMode === 'approval' ? 'var(--t-accent-fg)' : 'var(--t-text-2)',
              }}>
              Onayım Gerekli
            </button>
          </div>
        </div>

        {err && <p className="text-sm" style={{ color: '#f43f5e' }}>{err}</p>}

        <button type="button" onClick={submit} disabled={busy}
          className="w-full rounded-xl px-4 py-3 text-sm font-bold transition-colors disabled:opacity-40"
          style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
          {busy ? 'Oluşturuluyor…' : 'Dersi Oluştur'}
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest t-muted">Derslerim</p>
        {lessons === null ? (
          <p className="text-xs t-muted">Yükleniyor…</p>
        ) : lessons.length === 0 ? (
          <p className="text-xs t-muted">Henüz bir ders oluşturmadın.</p>
        ) : lessons.map((l) => (
          <div key={l.id} className="t-card p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{l.title}</p>
              <p className="text-xs t-muted">
                {new Date(l.scheduled_at).toLocaleString('tr-TR')} · {l.duration_minutes} dk · {STATUS_LABEL[l.status]}
              </p>
            </div>
            {l.status === 'scheduled' && (
              <button type="button" onClick={() => handleStart(l.id)}
                className="rounded-lg px-3 py-2 text-xs font-bold flex-shrink-0"
                style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
                Dersi Başlat
              </button>
            )}
            {l.status === 'live' && (
              <button type="button" onClick={() => router.push(`/coach/dersler-canli/${l.id}`)}
                className="rounded-lg px-3 py-2 text-xs font-bold flex-shrink-0"
                style={{ background: '#22c55e', color: '#0a0a0a' }}>
                Derse Git
              </button>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
