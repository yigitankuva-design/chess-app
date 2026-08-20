'use client';
import { useCallback, useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';
import {
  OPENING_CATEGORIES, groupOpenings, normalizeCategory,
} from '@/lib/play/openingCategories';
import type { OpeningCategory } from '@/lib/play/openingCategories';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Variant { id: number; name: string; start_fen: string }
interface Opening { id: number; name: string; category?: string | null; variants: Variant[] }

/**
 * Admin "Açılış Pratiği Yap": üç açılır kart (e4 / d4 / Diğer). Her kartta
 * açılış İSİMLERİ listelenir (FEN yok); bir açılış ismine tıklayınca o
 * açılışın VARYANTLARI (isim + FEN) açılır (madde: 2026-08-20 — yeni
 * seviye). Açılışlar tek listede tutulur, kartlar o listeyi kategoriye
 * göre süzer. Eski /admin/openings sayfasının yerini alır.
 */
export function OpeningCategoryCards({ color }: { color: string }) {
  const [list, setList] = useState<Opening[] | null>(null);
  /** "Açılış Pratiği Yap" başlığı kapalıyken üç kategori kartı görünmez. */
  const [sectionOpen, setSectionOpen] = useState(false);
  const [openKey, setOpenKey] = useState<OpeningCategory | null>(null);
  /** Kategori kartı içinde açık olan TEK açılış (isim) — varyantları gösterir. */
  const [openOpeningId, setOpenOpeningId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<OpeningCategory>('diger');
  const [editErr, setEditErr] = useState<string | null>(null);

  const [variantName, setVariantName] = useState('');
  const [variantFen, setVariantFen] = useState('');
  const [variantErr, setVariantErr] = useState<string | null>(null);
  const [editingVariantId, setEditingVariantId] = useState<number | null>(null);
  const [editVariantName, setEditVariantName] = useState('');
  const [editVariantFen, setEditVariantFen] = useState('');
  const [editVariantErr, setEditVariantErr] = useState<string | null>(null);

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
        body: JSON.stringify({ name, category }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setErr(typeof body.detail === 'string' ? body.detail : 'Eklenemedi');
        return;
      }
      setName('');
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
      if (openOpeningId === id) setOpenOpeningId(null);
      await load();
    } catch { /* yoksay */ }
  }

  function startEdit(o: Opening) {
    setEditingId(o.id);
    setEditName(o.name);
    setEditCategory(normalizeCategory(o.category));
    setEditErr(null);
  }

  async function saveEdit(id: number) {
    setEditErr(null);
    try {
      const r = await fetch(`${API_BASE}/admin/openings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: editName, category: editCategory }),
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

  async function addVariant(openingId: number) {
    setVariantErr(null);
    try {
      const r = await fetch(`${API_BASE}/admin/openings/${openingId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: variantName, start_fen: variantFen }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setVariantErr(typeof body.detail === 'string' ? body.detail : 'Eklenemedi');
        return;
      }
      setVariantName(''); setVariantFen('');
      await load();
    } catch {
      setVariantErr('Eklenemedi');
    }
  }

  async function removeVariant(id: number) {
    try {
      await fetch(`${API_BASE}/admin/opening-variants/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await load();
    } catch { /* yoksay */ }
  }

  function startEditVariant(v: Variant) {
    setEditingVariantId(v.id);
    setEditVariantName(v.name);
    setEditVariantFen(v.start_fen);
    setEditVariantErr(null);
  }

  async function saveEditVariant(id: number) {
    setEditVariantErr(null);
    try {
      const r = await fetch(`${API_BASE}/admin/opening-variants/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: editVariantName, start_fen: editVariantFen }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setEditVariantErr(typeof body.detail === 'string' ? body.detail : 'Kaydedilemedi');
        return;
      }
      setEditingVariantId(null);
      await load();
    } catch {
      setEditVariantErr('Kaydedilemedi');
    }
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
              onClick={() => { setOpenKey((p) => (p === cat.key ? null : cat.key)); setErr(null); setOpenOpeningId(null); }}
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
                  {err && <p className="text-rose-400 text-xs">{err}</p>}
                  <button type="button" onClick={() => add(cat.key)}
                    disabled={!name.trim()}
                    className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40 text-sm">
                    Açılış ismi ekle
                  </button>
                </div>

                <div className="space-y-2">
                  {rows.length === 0 && (
                    <p className="text-xs n-muted">Bu türde henüz açılış yok.</p>
                  )}
                  {rows.map((o, i) => {
                    const editing = editingId === o.id;
                    const openingExpanded = openOpeningId === o.id;
                    return (
                      <div key={o.id} className="rounded-lg border border-white/10 p-2.5">
                        {editing ? (
                          <div className="space-y-2">
                            <input value={editName} onChange={(e) => setEditName(e.target.value)}
                              className="neon-input text-sm" placeholder="Açılış adı" />
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
                          <>
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
                              <button type="button"
                                onClick={() => setOpenOpeningId((p) => (p === o.id ? null : o.id))}
                                aria-expanded={openingExpanded}
                                aria-label={`${o.name} varyantlarını ${openingExpanded ? 'kapat' : 'aç'}`}
                                className="flex-1 min-w-0 text-left">
                                <p className="font-semibold text-sm n-text">{o.name}</p>
                                <p className="text-xs n-muted">{o.variants.length} varyant</p>
                              </button>
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

                            {/* Varyant Ekle bölümü — madde: 2026-08-20 (YENİ seviye). */}
                            {openingExpanded && (
                              <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
                                <div className="space-y-2">
                                  <input value={variantName} onChange={(e) => setVariantName(e.target.value)}
                                    placeholder="Varyant adı (örn. Klasik Varyant)" className="neon-input text-sm" />
                                  <input value={variantFen} onChange={(e) => setVariantFen(e.target.value)}
                                    placeholder="Varyanta ait FEN" className="neon-input text-sm" />
                                  {variantErr && <p className="text-rose-400 text-xs">{variantErr}</p>}
                                  <button type="button" onClick={() => addVariant(o.id)}
                                    disabled={!variantName.trim() || !variantFen.trim()}
                                    className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40 text-sm">
                                    Varyant ekle
                                  </button>
                                </div>

                                <div className="space-y-2">
                                  {o.variants.length === 0 && (
                                    <p className="text-xs n-muted">Bu açılışta henüz varyant yok.</p>
                                  )}
                                  {o.variants.map((v) => {
                                    const editingV = editingVariantId === v.id;
                                    return (
                                      <div key={v.id} className="rounded-lg border border-white/10 p-2.5">
                                        {editingV ? (
                                          <div className="space-y-2">
                                            <input value={editVariantName} onChange={(e) => setEditVariantName(e.target.value)}
                                              className="neon-input text-sm" placeholder="Varyant adı" />
                                            <input value={editVariantFen} onChange={(e) => setEditVariantFen(e.target.value)}
                                              className="neon-input text-sm" placeholder="Varyanta ait FEN" />
                                            {editVariantErr && <p className="text-rose-400 text-xs">{editVariantErr}</p>}
                                            <div className="flex gap-2">
                                              <button type="button" onClick={() => saveEditVariant(v.id)}
                                                className="px-3 py-1.5 rounded-lg text-xs bg-cyan-400/15 text-cyan-200 border border-cyan-400/50">
                                                Kaydet
                                              </button>
                                              <button type="button" onClick={() => setEditingVariantId(null)}
                                                className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/70 border border-white/15">
                                                Vazgeç
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                              <p className="font-semibold text-sm n-text">{v.name}</p>
                                              <p className="text-xs n-muted break-all">{v.start_fen}</p>
                                            </div>
                                            <button type="button" onClick={() => startEditVariant(v)}
                                              aria-label={`${v.name} varyantını düzenle`}
                                              className="px-3 py-1.5 rounded-lg text-xs bg-cyan-400/10 text-cyan-300 border border-cyan-400/40">
                                              Düzenle
                                            </button>
                                            <button type="button" onClick={() => removeVariant(v.id)}
                                              aria-label={`${v.name} varyantını sil`}
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
                          </>
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
