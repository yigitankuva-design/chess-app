'use client';
import { useState } from 'react';
import { EditButton, EditSheet } from '@/components/profile/ProfileEditors';
import type { CoachNote } from '@/lib/gamification/meApi';

/**
 * Madde 2026-09-11 (Görsel Turu Aşama E / Madde 9): "Hoca notu" kartı —
 * sporcu kendi profilinde antrenörün yazdığı SON notu (varsa) okur;
 * antrenör bir öğrencinin profilini görüntülerken (`/students/[id]`,
 * ProfileView'ın `childId` dalı) AYNI kartta not yazabilir/silebilir.
 *
 * S4 (Zafer): sadece SON not tutulur (yeni yazım eskisinin üzerine yazar —
 * ayrı bir "düzenle" ucu yok, bu yüzden "Not Yaz"/"Notu Değiştir" AYNI
 * kaydetme çağrısını kullanır), silinebilir. Antrenörün KENDİ profilinde
 * (coach/profile) bu kart HİÇ render edilmez (o sayfa bu bileşeni
 * kullanmıyor) — "antrenöre kendi hakkında not gösterilmez" kuralı böyle
 * sağlanıyor, ayrı bir bayrağa gerek yok.
 */
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="var(--t-accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function formatNoteDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface Props {
  note: CoachNote | null;
  /** Antrenörün öğrenci görünümü (childId verilince) — yazma/silme SADECE burada. */
  canManage: boolean;
  onSave: (text: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}

export function CoachNoteCard({ note, canManage, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const text = draft.trim();
    if (!text) { setErr('Not boş olamaz'); return; }
    setBusy(true); setErr(null);
    const ok = await onSave(text);
    setBusy(false);
    if (!ok) { setErr('Kaydedilemedi, tekrar dene'); return; }
    setEditing(false);
  }

  async function remove() {
    setBusy(true);
    const ok = await onDelete();
    setBusy(false);
    if (!ok) setErr('Silinemedi, tekrar dene');
  }

  return (
    <div className="t-card p-4 flex gap-3">
      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'var(--t-surface-2)' }}>
        <ChatIcon />
      </div>
      <div className="flex-1 min-w-0">
        {note ? (
          <>
            <p className="text-xs font-bold t-muted mb-0.5">{note.teacher_name}&apos;dan not</p>
            <p className="text-sm whitespace-pre-wrap">{note.text}</p>
            <p className="text-[11px] t-muted mt-1">{formatNoteDate(note.created_at)}</p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold t-muted mb-0.5">Hoca notu</p>
            <p className="text-sm t-muted italic">Hoca notu eklendiğinde burada görünecek.</p>
          </>
        )}
        {canManage && (
          <div className="flex items-center gap-2 mt-2">
            <EditButton onClick={() => { setDraft(note?.text ?? ''); setErr(null); setEditing(true); }}
              label={note ? 'Notu değiştir' : 'Not yaz'} />
            <span className="text-xs t-muted">{note ? 'Notu değiştir' : 'Not yaz'}</span>
            {note && (
              <button type="button" onClick={remove} disabled={busy}
                className="text-xs font-bold ml-auto disabled:opacity-40" style={{ color: 'var(--t-err-text)' }}>
                Sil
              </button>
            )}
          </div>
        )}
      </div>
      {editing && (
        <EditSheet title={note ? 'Notu değiştir' : 'Not yaz'} busy={busy} err={err} onSave={save} onCancel={() => setEditing(false)}>
          <label className="block text-[10px] font-bold uppercase tracking-wide t-muted">
            Not
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} rows={4}
              aria-label="Not" placeholder="Sporcuya bir not bırak…" autoFocus
              className="rounded-lg px-3 py-2 text-sm w-full mt-1 resize-none"
              style={{ background: 'var(--t-surface-2)', color: 'var(--t-text-1)', border: '1px solid var(--t-border)' }} />
          </label>
          <p className="text-[11px] t-muted">Sporcu bu notu profilinde görür ve bir bildirim alır.</p>
        </EditSheet>
      )}
    </div>
  );
}
