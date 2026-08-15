'use client';
import { useCallback, useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';
import {
  OPENING_CATEGORIES, groupOpenings, normalizeCategory,
} from '@/lib/play/openingCategories';
import type { OpeningCategory } from '@/lib/play/openingCategories';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Opening { id: number; name: string; start_fen: string; category?: string | null }

/**
 * Admin "Açılış Pratiği Yap": üç açılır kart (e4 / d4 / Diğerleri).
 * Açılışlar tek listede tutulur, kartlar o listeyi kategoriye göre süzer.
 * Eski /admin/openings sayfasının yerini alır.
 */
export function OpeningCategoryCards({ color }: { color: string }) {
  const [list, setList] = useState<Opening[] | null>(null);
  /** "Açılış Pratiği Yap" başlığı kapalıyken üç kategori kartı görünmez. */
  const [sectionOpen, setSectionOpen] = useState(false);
  const [openKey, setOpenKey] = useState<OpeningCategory | null>(null);
  const [name, setName] = useState('');
  const [fen, setFen] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editFen, setEditFen] = useState('');
  const [editCategory, setEditCategory] = useState<OpeningCategory>('diger');
  const [editErr, setEditErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/openings`);
      const data = r.ok ? await r.json() : null;
      setList(Array.isArray(data) ? data : []);
    } catch {
      setList([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groups = groupOpenings(list ?? []);

  async function add(category: OpeningCategory) {
    setErr(null);
    try {
      const r = await fetch(`${API_BASE}/admin/openings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name, start_fen: fen, category }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setErr(typeof body.detail === 'string' ? body.detail : 'Eklenemedi');
        return;
      }
      setName(''); setFen('');
      await load();
    } catch {
      setErr('Eklenemedi');
    }
  }

  async function remove(id: number) {
    try {
      await fetch(`${API_BASE}/admin/openings/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await load();
    } catch { /* yoksay */ }
  }

  function startEdit(o: Opening) {
    setEditingId(o.id);
    setEditName(o.name);
    setEditFen(o.start_fen);
    setEditCategory(normalizeCategory(o.category));
    setEditErr(null);
  }

  async function saveEdit(id: number) {
    setEditErr(null);
    try {
      const r = await fetch(`${API_BASE}/admin/openings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: editName, start_fen: editFen, category: editCategory }),
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

  /** Açılışı listedeki komşusuyla yer değiştirir. */
  async function move(id: number, direction: 'up' | 'down') {
    try {
      await fetch(`${API_BASE}/admin/openings/${id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ direction }),
      });
      await load();
    } catch { /* yoksay */ }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setSectionOpen((p) => !p)}
        aria-expanded={sectionOpen}
        aria-label={`Açılış Pratiği Yap kartını ${sectionOpen ? 'kapat' : 'aç'}`}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-xl leading-none">📖</span>
        <span className="text-sm font-semibold flex-1" style={{ color }}>Açılış Pratiği Yap</span>
        <span className="text-xs n-muted">{sectionOpen ? '▴' : '▾'}</span>
      </button>

      {sectionOpen && (
        <div className="px-3 pb-3 space-y-2">
          {OPENING_CATEGORIES.map((cat) => {
        const rows = groups[cat.key];
        const open = openKey === cat.key;
        return (
          <div key={cat.key} className="rounded-lg border border-white/10 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => { setOpenKey((p) => (p === cat.key ? null : cat.key)); setErr(null); }}
              aria-expanded={open}
              aria-label={`${cat.title} kartını ${open ? 'kapat' : 'aç'}`}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
            >
              <span className="text-base leading-none">{cat.emoji}</span>
              <span className="text-sm font-semibold n-text flex-1">{cat.title}</span>
              <span className="text-xs n-muted">{list === null ? '…' : rows.length}</span>
              <span className="text-xs n-muted">{open ? '▴' : '▾'}</span>
            </button>

            {open && (
              <div className="px-3 pb-3 space-y-3">
                <div className="space-y-2">
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Açılış adı (örn. İtalyan Açılışı)" className="neon-input text-sm" />
                  <input value={fen} onChange={(e) => setFen(e.target.value)}
                    placeholder="Başlangıç FEN'i" className="neon-input text-sm" />
                  {err && <p className="text-rose-400 text-xs">{err}</p>}
                  <button type="button" onClick={() => add(cat.key)}
                    disabled={!name.trim() || !fen.trim()}
                    className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40 text-sm">
                    Açılış ekle
                  </button>
                </div>

                <div className="space-y-2">
                  {rows.length === 0 && (
                    <p className="text-xs n-muted">Bu türde henüz açılış yok.</p>
                  )}
                  {rows.map((o, i) => {
                    const editing = editingId === o.id;
                    return (
                      <div key={o.id} className="rounded-lg border border-white/10 p-2.5">
                        {editing ? (
                          <div className="space-y-2">
                            <input value={editName} onChange={(e) => setEditName(e.target.value)}
                              className="neon-input text-sm" placeholder="Açılış adı" />
                            <input value={editFen} onChange={(e) => setEditFen(e.target.value)}
                              className="neon-input text-sm" placeholder="Başlangıç FEN'i" />
                            <div className="flex gap-2 flex-wrap">
                              {OPENING_CATEGORIES.map((c2) => (
                                <button key={c2.key} type="button"
                                  onClick={() => setEditCategory(c2.key)}
                                  aria-pressed={editCategory === c2.key}
                                  className="px-3 py-1.5 rounded-lg text-xs border"
                                  style={{
                                    borderColor: editCategory === c2.key ? color : 'rgba(255,255,255,0.15)',
                                    background: editCategory === c2.key ? `${color}26` : 'transparent',
                                    color: editCategory === c2.key ? color : 'rgba(255,255,255,0.7)',
                                  }}>
                                  {c2.title}
                                </button>
                              ))}
                            </div>
                            {editErr && <p className="text-rose-400 text-xs">{editErr}</p>}
                            <div className="flex gap-2">
                              <button type="button" onClick={() => saveEdit(o.id)}
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
                              <button type="button" onClick={() => move(o.id, 'up')} disabled={i === 0}
                                aria-label={`${o.name} yukarı taşı`}
                                className="w-6 h-6 flex items-center justify-center rounded text-xs bg-white/5 text-white/70 border border-white/15 disabled:opacity-30">
                                ▲
                              </button>
                              <button type="button" onClick={() => move(o.id, 'down')} disabled={i === rows.length - 1}
                                aria-label={`${o.name} aşağı taşı`}
                                className="w-6 h-6 flex items-center justify-center rounded text-xs bg-white/5 text-white/70 border border-white/15 disabled:opacity-30">
                                ▼
                              </button>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm n-text">{o.name}</p>
                              <p className="text-xs n-muted break-all">{o.start_fen}</p>
                            </div>
                            <button type="button" onClick={() => startEdit(o)}
                              aria-label={`${o.name} açılışını düzenle`}
                              className="px-3 py-1.5 rounded-lg text-xs bg-cyan-400/10 text-cyan-300 border border-cyan-400/40">
                              Düzenle
                            </button>
                            <button type="button" onClick={() => remove(o.id)}
                              aria-label={`${o.name} açılışını sil`}
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
            )}
          </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
