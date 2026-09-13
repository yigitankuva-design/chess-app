'use client';
import { useState } from 'react';
import { EditSheet } from '@/components/profile/ProfileEditors';
import type { ClassInfo } from '@/lib/gamification/meApi';

/**
 * Madde 2026-09-13 (Sınıflarım — Madde 3): "Sınıf Bilgileri" kartı —
 * İletişim Bilgileri'nin hemen altında. Sporcu henüz bir sınıfa
 * katılmadıysa (classInfo null) "Sınıfa Katıl" düğmesiyle antrenörün
 * verdiği kodu girer (bkz. CoachNoteCard/EditSheet ile AYNI desen —
 * Zafer'in onayı 2026-09-13: "evet bu deseni burada da istiyorum").
 * Antrenörün öğrenci görünümünde (canJoin=false) katılma eylemi
 * gösterilmez — salt-okunur bilgi kartı.
 */
function ClassIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--t-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13.5" />
      <path d="M4 19.5A1.5 1.5 0 0 1 5.5 18H20" />
      <path d="M8 7h8M8 11h8" />
    </svg>
  );
}

interface Props {
  classInfo: ClassInfo | null;
  /** Sporcunun KENDİ profili — antrenörün öğrenci görünümünde false. */
  canJoin: boolean;
  onJoin: (code: string) => Promise<{ ok: boolean; error?: string }>;
}

export function ClassInfoCard({ classInfo, canJoin, onJoin }: Props) {
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const trimmed = code.trim();
    if (!trimmed) { setErr('Kod boş olamaz'); return; }
    setBusy(true); setErr(null);
    const res = await onJoin(trimmed);
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? 'Katılınamadı'); return; }
    setJoining(false);
    setCode('');
  }

  return (
    <div className="t-card p-4">
      <div className="flex items-center gap-2 mb-3 pb-3 border-b" style={{ borderColor: 'var(--t-border)' }}>
        <ClassIcon />
        <span className="text-xs font-bold uppercase tracking-wide t-muted">Sınıflarım</span>
      </div>
      {classInfo ? (
        <div className="text-sm space-y-0.5">
          <p className="font-semibold">{classInfo.class_name}</p>
          <p className="t-muted text-xs">
            {classInfo.teacher_name ?? 'Antrenör'} · {classInfo.student_count} sporcu
          </p>
        </div>
      ) : canJoin ? (
        <button type="button" onClick={() => { setErr(null); setJoining(true); }}
          className="rounded-lg px-4 py-2 text-sm font-bold"
          style={{ background: 'var(--t-accent)', color: 'var(--t-accent-fg)' }}>
          Sınıfa Katıl
        </button>
      ) : (
        <p className="text-sm t-muted italic">Henüz bir sınıfa katılmadı.</p>
      )}
      {joining && (
        <EditSheet title="Sınıfa Katıl" busy={busy} err={err} onSave={submit} onCancel={() => setJoining(false)}>
          <label className="block text-[10px] font-bold uppercase tracking-wide t-muted">
            Sınıf Kodu
            <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8} autoFocus aria-label="Sınıf Kodu" placeholder="ör. AB12CD34"
              className="rounded-lg px-3 py-2 text-sm w-full mt-1 tracking-widest font-mono"
              style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }} />
          </label>
          <p className="text-[11px] t-muted">Antrenörünün sana verdiği sınıf kodunu gir.</p>
        </EditSheet>
      )}
    </div>
  );
}
