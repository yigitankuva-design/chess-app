'use client';
import { useState } from 'react';

interface Props {
  value: string;
  onSave: (next: string) => Promise<boolean>;
  ariaLabel: string;
  textClassName?: string;
}

/** Modül/ders/ders-adımı başlıkları için tekrar kullanılan satır-içi düzenleme.
 *  Tıklama olayları içeride durdurulur — bir `<Link>` içine konursa navigasyonu
 *  tetiklemez (KURAL: modül satırı tamamı tıklanabilir, düzenle butonu istisna). */
export function InlineTitleEdit({ value, onSave, ariaLabel, textClassName }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDraft(value);
    setErr(null);
    setEditing(true);
  }

  async function save() {
    if (!draft.trim()) { setErr('Başlık boş olamaz'); return; }
    setSaving(true);
    const ok = await onSave(draft.trim());
    setSaving(false);
    if (ok) setEditing(false);
    else setErr('Kaydedilemedi');
  }

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className={textClassName}>{value}</span>
        <button type="button" onClick={startEdit} aria-label={ariaLabel} title="Başlığı düzenle"
          className="text-white/40 hover:text-cyan-300 transition-colors">
          ✎
        </button>
      </span>
    );
  }

  return (
    <span onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-2">
      <input value={draft} onChange={(e) => setDraft(e.target.value)}
        aria-label={ariaLabel} className="neon-input py-1 text-sm" autoFocus />
      <button type="button" onClick={save} disabled={saving}
        className="px-2 py-1 rounded-md text-xs bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-50">
        {saving ? '...' : 'Kaydet'}
      </button>
      <button type="button" onClick={() => setEditing(false)}
        className="px-2 py-1 rounded-md text-xs bg-white/5 text-white/70 border border-white/15 hover:bg-white/10">
        İptal
      </button>
      {err && <span className="text-rose-400 text-xs">{err}</span>}
    </span>
  );
}
