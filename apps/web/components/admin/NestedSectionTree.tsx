'use client';
import { useState } from 'react';
import { IconPicker } from './IconPicker';
import { compressImageToDataUri } from '@/lib/imageCompress';
import {
  createCustomTabSection, updateCustomTabSection, deleteCustomTabSection,
} from '@/lib/customTabsApi';
import type { CustomTabSection } from '@/lib/customTabsApi';

interface Props {
  tabId: number;
  /** Bu düzeyde hangi bölümlerin listeleneceğini belirler — null = sekmenin
   *  en üst seviyesi. */
  parentId: number | null;
  /** Sekmenin TÜM bölümleri (düz liste) — her çağrı kendi çocuklarını burada filtreler. */
  allSections: CustomTabSection[];
  /** İç içelik derinliği — girinti ve kart tonunu belirler. */
  depth: number;
  /** Yeni bölüm eklenince çağrılır — üst bileşen yerel listeye ekler
   *  (sunucuya YENİDEN İSTEK ATMADAN — mevcut admin CRUD deseniyle AYNI). */
  onSectionCreated: (section: CustomTabSection) => void;
  /** Bir bölüm düzenlenince çağrılır — üst bileşen yerel listede günceller. */
  onSectionUpdated: (id: number, patch: Partial<CustomTabSection>) => void;
  /** Bir bölüm silinince çağrılır. Silme İÇ İÇE torunları da kapsayabildiği
   *  (cascade) için, hangi id'lerin gittiğini yerel olarak bilemeyiz —
   *  bu yüzden silme sonrası sunucudan TAZE liste çekilir. */
  onReloadAfterDelete: () => Promise<void>;
}

/**
 * Bir özel sekmenin alt sekmelerini İÇ İÇE (sınırsız derinlikte) gösterir ve
 * yönetir (madde: 2026-08-22 — "Antrenör" sekmesi/"Sınıflar" ihtiyacı).
 * Her düzey kendi "hangi bölüm açık / düzenleniyor / yeni ekleniyor" durumunu
 * KENDİSİ tutar (bağımsız akordiyon) — Açılış Pratiği'ndeki tür→isim→varyant
 * ic ice akordiyonuyla AYNI ruh, admin panelinin kendi görsel diliyle
 * (neon-card, cyan/rose butonlar) çizilir.
 */
export function NestedSectionTree({
  tabId, parentId, allSections, depth, onSectionCreated, onSectionUpdated, onReloadAfterDelete,
}: Props) {
  const children = allSections
    .filter((s) => (s.parent_id ?? null) === parentId)
    .sort((a, b) => a.order_index - b.order_index);

  const [openId, setOpenId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editEmoji, setEditEmoji] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [newEmoji, setNewEmoji] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function startEdit(s: CustomTabSection) {
    setEditingId(s.id);
    setEditTitle(s.title);
    setEditBody(s.body);
    setEditImages(s.images);
    setEditEmoji(s.emoji ?? null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle(''); setEditBody(''); setEditImages([]); setEditEmoji(null);
  }

  async function saveEdit(id: number) {
    const title = editTitle.trim();
    if (!title) { setErr('Alt sekme başlığı gerekli'); return; }
    setBusy(true); setErr(null);
    const patch = {
      title, body: editBody.trim(), images: editImages, ...(editEmoji ? { emoji: editEmoji } : {}),
    };
    const ok = await updateCustomTabSection(id, patch);
    setBusy(false);
    if (!ok) { setErr('Kaydedilemedi'); return; }
    onSectionUpdated(id, patch);
    cancelEdit();
  }

  async function remove(id: number) {
    setBusy(true);
    const ok = await deleteCustomTabSection(id);
    setBusy(false);
    if (!ok) { setErr('Silinemedi'); return; }
    if (openId === id) setOpenId(null);
    await onReloadAfterDelete();
  }

  async function addChild() {
    const title = newTitle.trim();
    if (!title) { setErr('Alt sekme başlığı gerekli'); return; }
    setBusy(true); setErr(null);
    // Madde 2026-08-22: gereksiz "undefined" argümanlar EKLENMEZ — kök
    // seviyede emoji/parent verilmediğinde çağrı eski (4 argümanlı) haliyle
    // AYNI kalır, mevcut testlerle uyumlu.
    const body = newBody.trim();
    const created = parentId !== null
      ? await createCustomTabSection(tabId, title, body, newImages, newEmoji ?? undefined, parentId)
      : newEmoji
        ? await createCustomTabSection(tabId, title, body, newImages, newEmoji)
        : await createCustomTabSection(tabId, title, body, newImages);
    setBusy(false);
    if (!created) { setErr('Eklenemedi'); return; }
    onSectionCreated(created);
    setNewTitle(''); setNewBody(''); setNewImages([]); setNewEmoji(null);
  }

  async function onNewImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const compressed = await Promise.all(Array.from(files).map((f) => compressImageToDataUri(f)));
    setNewImages((prev) => [...prev, ...compressed]);
  }

  async function onEditImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const compressed = await Promise.all(Array.from(files).map((f) => compressImageToDataUri(f)));
    setEditImages((prev) => [...prev, ...compressed]);
  }

  const indent = depth > 0 ? { marginLeft: 14, paddingLeft: 12, borderLeft: '2px dashed rgba(255,255,255,0.15)' } : {};

  return (
    <div className="space-y-2" style={indent}>
      {children.length === 0 && (
        <p className="text-xs n-muted">Henüz alt sekme yok. Aşağıdan ekleyebilirsin.</p>
      )}
      {children.map((s) => {
        const open = openId === s.id;
        const editing = editingId === s.id;
        return (
          <div key={s.id} className="rounded-lg border border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <IconPicker
                value={s.emoji ?? undefined}
                onChange={async (emoji) => {
                  const ok = await updateCustomTabSection(s.id, { emoji });
                  if (ok) onSectionUpdated(s.id, { emoji });
                }}
                size={30}
                ariaLabel={`${s.title} ikonunu değiştir`}
              />
              <button type="button"
                onClick={() => setOpenId((p) => (p === s.id ? null : s.id))}
                aria-expanded={open}
                className="flex-1 flex items-center gap-2 text-left hover:bg-white/5 transition-colors">
                <span className="text-sm font-semibold n-text flex-1">{s.title}</span>
                <span className="text-xs n-muted">{open ? '▴' : '▾'}</span>
              </button>
              <button type="button" onClick={() => startEdit(s)}
                aria-label={`${s.title} alt sekmesini düzenle`}
                className="px-2 py-1 rounded-md text-cyan-300 hover:bg-cyan-400/10 text-xs">
                Düzenle
              </button>
              <button type="button" onClick={() => remove(s.id)} disabled={busy}
                aria-label={`${s.title} alt sekmesini sil`}
                className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs disabled:opacity-40">
                Sil
              </button>
            </div>

            {editing ? (
              <div className="px-3 pb-3 space-y-2">
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Alt sekme başlığı" className="neon-input text-sm" />
                <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)}
                  placeholder="Yazı" rows={3} className="neon-input text-sm" />
                <input type="file" accept="image/*" multiple className="hidden" id={`nst-edit-image-${s.id}`}
                  onChange={(e) => onEditImageFiles(e.target.files)} />
                <label htmlFor={`nst-edit-image-${s.id}`}
                  className="inline-block px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
                  Bilgisayardan Seç
                </label>
                {editImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {editImages.map((uri, i) => (
                      <img key={i} src={uri} alt={`Görsel ${i + 1}`}
                        style={{ maxWidth: 60, maxHeight: 45, objectFit: 'contain' }} />
                    ))}
                  </div>
                )}
                {err && <p className="text-rose-400 text-xs">{err}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => saveEdit(s.id)} disabled={busy || !editTitle.trim()}
                    className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-sm transition-colors">
                    Kaydet
                  </button>
                  <button type="button" onClick={cancelEdit}
                    className="px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-sm transition-colors">
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : open && (
              <div className="px-3 pb-3 space-y-3">
                {s.body && <p className="text-sm n-muted whitespace-pre-wrap">{s.body}</p>}
                {s.images.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {s.images.map((uri, i) => (
                      <img key={i} src={uri} alt={`${s.title} görseli ${i + 1}`}
                        style={{ maxWidth: 80, maxHeight: 60, objectFit: 'contain' }} />
                    ))}
                  </div>
                )}

                {/* Bu bölümün KENDİ alt sekmeleri — iç içe (sınırsız derinlik).
                    Bu ic-ice cagri KENDI "+ Alt Sekme Ekle" formunu da (s'nin
                    cocuklari icin) HER ZAMAN gorunur sekilde cizer — bkz. asagida
                    bu bilesenin KENDI seviyesi icin aynı deseni tekrarlaması. */}
                <div className="pt-2 border-t border-white/10">
                  <NestedSectionTree
                    tabId={tabId} parentId={s.id} allSections={allSections}
                    depth={depth + 1}
                    onSectionCreated={onSectionCreated}
                    onSectionUpdated={onSectionUpdated}
                    onReloadAfterDelete={onReloadAfterDelete}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Madde 2026-08-22: bu ekleme formu BU SEVİYEDE her zaman görünür —
          kök seviyede (parentId=null) tab açılır açılmaz görünür, iç içe bir
          seviyede ise o üst bölüm açılınca (yukarıdaki recursive çağrı ile)
          görünür. Herhangi bir kardeşin açık olup olmamasına BAĞLI DEĞİL. */}
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
        <p className="text-xs font-bold n-muted uppercase tracking-widest">+ Alt Sekme Ekle</p>
        <div className="flex items-center gap-2">
          <IconPicker value={newEmoji ?? undefined} onChange={setNewEmoji} size={30}
            ariaLabel="Yeni alt sekmenin ikonunu seç" />
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Alt sekme başlığı" className="neon-input text-sm flex-1" />
        </div>
        <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)}
          placeholder="Yazı" rows={3} className="neon-input text-sm" />
        <input type="file" accept="image/*" multiple className="hidden" id={`nst-new-image-${tabId}-${parentId ?? 'root'}`}
          onChange={(e) => onNewImageFiles(e.target.files)} />
        <label htmlFor={`nst-new-image-${tabId}-${parentId ?? 'root'}`}
          className="inline-block px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
          Bilgisayardan Seç
        </label>
        {newImages.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {newImages.map((uri, i) => (
              <img key={i} src={uri} alt={`Yeni görsel ${i + 1}`}
                style={{ maxWidth: 60, maxHeight: 45, objectFit: 'contain' }} />
            ))}
          </div>
        )}
        {err && <p className="text-rose-400 text-xs">{err}</p>}
        <button type="button" onClick={addChild} disabled={busy || !newTitle.trim()}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-sm transition-colors">
          Alt sekme ekle
        </button>
      </div>
    </div>
  );
}
