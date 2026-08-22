'use client';
import { useCallback, useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';
import { IconPicker } from '@/components/admin/IconPicker';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface FunActivity { id: number; name: string; description: string; emoji: string }

/**
 * Admin "Eğlence": madde 2026-08-21 — oyun/yarışma türleri admin'in serbestçe
 * ekleyip/düzenleyip/sildiği bir liste. Opening/OpeningType ile AYNI CRUD
 * deseni (ekle formu + satır listesi), ek olarak açıklama metni ve ikon.
 */
export function FunActivityFields() {
  const [list, setList] = useState<FunActivity[] | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editErr, setEditErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/fun-activities`);
      const data = r.ok ? await r.json() : null;
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function add() {
    setErr(null);
    try {
      const r = await fetch(`${API_BASE}/admin/fun-activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name, description, emoji }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setErr(typeof body.detail === 'string' ? body.detail : 'Eklenemedi');
        return;
      }
      setName(''); setDescription(''); setEmoji('');
      await load();
    } catch {
      setErr('Eklenemedi');
    }
  }

  async function remove(id: number) {
    try {
      await fetch(`${API_BASE}/admin/fun-activities/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await load();
    } catch { /* yoksay */ }
  }

  function startEdit(a: FunActivity) {
    setEditingId(a.id);
    setEditName(a.name);
    setEditDescription(a.description);
    setEditEmoji(a.emoji);
    setEditErr(null);
  }

  async function saveEdit(id: number) {
    setEditErr(null);
    try {
      const r = await fetch(`${API_BASE}/admin/fun-activities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: editName, description: editDescription, emoji: editEmoji }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setEditErr(typeof body.detail === 'string' ? body.detail : 'Kaydedilemedi');
        return;
      }
      setEditingId(null);
      await load();
    } catch {
      setEditErr('Kaydedilemedi');
    }
  }

  /** Kartı listedeki komşusuyla yer değiştirir. */
  async function move(id: number, direction: 'up' | 'down') {
    try {
      await fetch(`${API_BASE}/admin/fun-activities/${id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ direction }),
      });
      await load();
    } catch { /* yoksay */ }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <IconPicker value={emoji} onChange={setEmoji} ariaLabel="Yeni oyun/yarışmanın ikonunu seç" />
          <input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Oyun/yarışma adı (örn. Koordinat Yarışı)" className="neon-input text-sm flex-1" />
        </div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Kısa açıklama (opsiyonel)" rows={2} className="neon-input text-sm w-full" />
        {err && <p className="text-rose-400 text-xs">{err}</p>}
        <button type="button" onClick={add}
          disabled={!name.trim() || !emoji.trim()}
          className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40 text-sm">
          Oyun/yarışma ekle
        </button>
      </div>

      <div className="space-y-2">
        {list === null && <p className="text-xs n-muted">Yükleniyor…</p>}
        {list !== null && list.length === 0 && (
          <p className="text-xs n-muted">Henüz oyun/yarışma eklenmedi.</p>
        )}
        {list?.map((a, i) => {
          const editing = editingId === a.id;
          return (
            <div key={a.id} className="rounded-lg border border-white/10 p-2.5">
              {editing ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <IconPicker value={editEmoji} onChange={setEditEmoji} ariaLabel={`${a.name} ikonunu değiştir`} />
                    <input value={editName} onChange={(e) => setEditName(e.target.value)}
                      className="neon-input text-sm flex-1" placeholder="Ad" />
                  </div>
                  <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)}
                    rows={2} className="neon-input text-sm w-full" placeholder="Açıklama" />
                  {editErr && <p className="text-rose-400 text-xs">{editErr}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => saveEdit(a.id)}
                      className="px-3 py-1.5 rounded-lg text-xs bg-cyan-400/15 text-cyan-200 border border-cyan-400/50">
                      Kaydet
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/70 border border-white/15">
                      Vazgeç
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => move(a.id, 'up')} disabled={i === 0}
                      aria-label={`${a.name} yukarı taşı`}
                      className="w-6 h-6 flex items-center justify-center rounded text-xs bg-white/5 text-white/70 border border-white/15 disabled:opacity-30">
                      ▲
                    </button>
                    <button type="button" onClick={() => move(a.id, 'down')} disabled={i === (list?.length ?? 0) - 1}
                      aria-label={`${a.name} aşağı taşı`}
                      className="w-6 h-6 flex items-center justify-center rounded text-xs bg-white/5 text-white/70 border border-white/15 disabled:opacity-30">
                      ▼
                    </button>
                  </div>
                  <span className="text-xl leading-none">{a.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm n-text">{a.name}</p>
                    {a.description && <p className="text-xs n-muted truncate">{a.description}</p>}
                  </div>
                  <button type="button" onClick={() => startEdit(a)}
                    aria-label={`${a.name} kartını düzenle`}
                    className="px-3 py-1.5 rounded-lg text-xs bg-cyan-400/10 text-cyan-300 border border-cyan-400/40">
                    Düzenle
                  </button>
                  <button type="button" onClick={() => remove(a.id)}
                    aria-label={`${a.name} kartını sil`}
                    className="px-3 py-1.5 rounded-lg text-xs bg-rose-400/10 text-rose-300 border border-rose-400/40">
                    Sil
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
