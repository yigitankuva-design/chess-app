'use client';
import { useCallback, useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Variant { id: number; name: string; start_fen: string }
interface Opening { id: number; name: string; variants: Variant[] }
interface OpeningType { id: number; name: string; openings: Opening[] }

/**
 * Admin "Açılış Pratiği Yap": madde 2026-08-20 — "Açılış Türü" artık sabit
 * e4/d4/diğer DEĞİL, admin'in serbestçe ekleyip/düzenleyip/sildiği bir veri
 * seviyesi. Akış ÜÇ katmanlı akordiyon: Açılış Türü Ekle -> (tıkla) Açılış
 * İsmi Ekle -> (tıkla) Varyant İsmi Ekle + FEN. Her katmanda ekle formu +
 * satır listesi AYNI desende tekrar eder.
 */
export function OpeningCategoryCards({ color }: { color: string }) {
  const [list, setList] = useState<OpeningType[] | null>(null);
  /** "Açılış Pratiği Yap" başlığı kapalıyken hiçbir tür görünmez. */
  const [sectionOpen, setSectionOpen] = useState(false);

  const [typeName, setTypeName] = useState('');
  const [typeErr, setTypeErr] = useState<string | null>(null);
  const [openTypeId, setOpenTypeId] = useState<number | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editTypeName, setEditTypeName] = useState('');
  const [editTypeErr, setEditTypeErr] = useState<string | null>(null);

  /** Açık türün içinde açık olan TEK açılış (isim) — varyantları gösterir. */
  const [openOpeningId, setOpenOpeningId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
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

  async function addType() {
    setTypeErr(null);
    try {
      const r = await fetch(`${API_BASE}/admin/opening-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: typeName }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setTypeErr(typeof body.detail === 'string' ? body.detail : 'Eklenemedi');
        return;
      }
      setTypeName('');
      await load();
    } catch {
      setTypeErr('Eklenemedi');
    }
  }

  async function removeType(id: number) {
    try {
      await fetch(`${API_BASE}/admin/opening-types/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (openTypeId === id) { setOpenTypeId(null); setOpenOpeningId(null); }
      await load();
    } catch { /* yoksay */ }
  }

  function startEditType(t: OpeningType) {
    setEditingTypeId(t.id);
    setEditTypeName(t.name);
    setEditTypeErr(null);
  }

  async function saveEditType(id: number) {
    setEditTypeErr(null);
    try {
      const r = await fetch(`${API_BASE}/admin/opening-types/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: editTypeName }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        setEditTypeErr(typeof body.detail === 'string' ? body.detail : 'Kaydedilemedi');
        return;
      }
      setEditingTypeId(null);
      await load();
    } catch {
      setEditTypeErr('Kaydedilemedi');
    }
  }

  async function add(openingTypeId: number) {
    setErr(null);
    try {
      const r = await fetch(`${API_BASE}/admin/openings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name, opening_type_id: openingTypeId }),
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
    setEditErr(null);
  }

  async function saveEdit(id: number) {
    setEditErr(null);
    try {
      const r = await fetch(`${API_BASE}/admin/openings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name: editName }),
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
        <div className="px-3 pb-3 space-y-3">
          {/* Açılış Türü Ekle — madde: 2026-08-20 (YENİ, en üst katman). */}
          <div className="space-y-2">
            <input value={typeName} onChange={(e) => setTypeName(e.target.value)}
              placeholder="Açılış türü adı (örn. e4'lü Açılışlar)" className="neon-input text-sm" />
            {typeErr && <p className="text-rose-400 text-xs">{typeErr}</p>}
            <button type="button" onClick={addType}
              disabled={!typeName.trim()}
              className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40 text-sm">
              Açılış türü ekle
            </button>
          </div>

          <div className="space-y-2">
            {list !== null && list.length === 0 && (
              <p className="text-xs n-muted">Henüz açılış türü yok.</p>
            )}
            {(list ?? []).map((t) => {
              const open = openTypeId === t.id;
              const editingType = editingTypeId === t.id;
              return (
                <div key={t.id} className="rounded-lg border border-white/10 bg-white/[0.03]">
                  {editingType ? (
                    <div className="p-3 space-y-2">
                      <input value={editTypeName} onChange={(e) => setEditTypeName(e.target.value)}
                        className="neon-input text-sm" placeholder="Açılış türü adı" />
                      {editTypeErr && <p className="text-rose-400 text-xs">{editTypeErr}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => saveEditType(t.id)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-cyan-400/15 text-cyan-200 border border-cyan-400/50">
                          Kaydet
                        </button>
                        <button type="button" onClick={() => setEditingTypeId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/70 border border-white/15">
                          Vazgeç
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenTypeId((p) => (p === t.id ? null : t.id));
                          setErr(null); setOpenOpeningId(null);
                        }}
                        aria-expanded={open}
                        aria-label={`${t.name} kartını ${open ? 'kapat' : 'aç'}`}
                        className="flex-1 min-w-0 flex items-center gap-2 text-left hover:bg-white/5 transition-colors rounded"
                      >
                        <span className="text-sm font-semibold n-text flex-1">{t.name}</span>
                        <span className="text-xs n-muted">{t.openings.length}</span>
                        <span className="text-xs n-muted">{open ? '▴' : '▾'}</span>
                      </button>
                      <button type="button" onClick={() => startEditType(t)}
                        aria-label={`${t.name} türünü düzenle`}
                        className="px-3 py-1.5 rounded-lg text-xs bg-cyan-400/10 text-cyan-300 border border-cyan-400/40">
                        Düzenle
                      </button>
                      <button type="button" onClick={() => removeType(t.id)}
                        aria-label={`${t.name} türünü sil`}
                        className="px-3 py-1.5 rounded-lg text-xs bg-rose-400/10 text-rose-300 border border-rose-400/40">
                        Sil
                      </button>
                    </div>
                  )}

                  {open && (
                    <div className="px-3 pb-3 space-y-3">
                      <div className="space-y-2">
                        <input value={name} onChange={(e) => setName(e.target.value)}
                          placeholder="Açılış adı (örn. İtalyan Açılışı)" className="neon-input text-sm" />
                        {err && <p className="text-rose-400 text-xs">{err}</p>}
                        <button type="button" onClick={() => add(t.id)}
                          disabled={!name.trim()}
                          className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 disabled:opacity-40 text-sm">
                          Açılış ismi ekle
                        </button>
                      </div>

                      <div className="space-y-2">
                        {t.openings.length === 0 && (
                          <p className="text-xs n-muted">Bu türde henüz açılış yok.</p>
                        )}
                        {t.openings.map((o, i) => {
                          const editing = editingId === o.id;
                          const openingExpanded = openOpeningId === o.id;
                          return (
                            <div key={o.id} className="rounded-lg border border-white/10 p-2.5">
                              {editing ? (
                                <div className="space-y-2">
                                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                                    className="neon-input text-sm" placeholder="Açılış adı" />
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
                                      <button type="button" onClick={() => move(o.id, 'down')} disabled={i === t.openings.length - 1}
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

                                  {/* Varyant Ekle bölümü. */}
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
        </div>
      )}
    </div>
  );
}
