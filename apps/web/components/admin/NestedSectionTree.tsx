'use client';
import { useState } from 'react';
import { IconPicker } from './IconPicker';
import { compressImageToDataUri } from '@/lib/imageCompress';
import {
  createCustomTabSection, updateCustomTabSection, deleteCustomTabSection,
  duplicateCustomTabSection,
} from '@/lib/customTabsApi';
import type { CustomTabSection, PositionPoolEntry, PositionPoolStep } from '@/lib/customTabsApi';
import { AltKonuExercisesFields } from './AltKonuExercisesFields';
import type { BoardExercise } from './ExerciseForm';
import { AltKonuPositionPoolFields } from './AltKonuPositionPoolFields';

/** Madde 2026-08-24: "Antrenör" sekmesindeki "Dersler" alt sekmesi ve TÜM
 *  altındaki Düzey/Konu/Alt Konu düğümleri özel bir moda girer — Kopyala
 *  YOKTUR, ve en derin seviye (Alt Konu, 3. derinlik) "+ Alt Sekme Ekle"
 *  yerine "Süresiz Pratik Yap" ile AYNI konum havuzu arayüzünü gösterir. */
const DERSLER_TITLE = 'Dersler';
const ALT_KONU_DEPTH = 3;

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
  /** Bir bölüm silinince ya da KOPYALANINCA çağrılır. Silme İÇ İÇE torunları
   *  da kapsayabildiği (cascade), kopyalama da sunucuda YENİ birden çok satır
   *  oluşturduğu (torunlarıyla) için, hangi id'lerin geldiğini/gittiğini
   *  yerel olarak bilemeyiz — bu yüzden sonrasında sunucudan TAZE liste çekilir. */
  onReloadTree: () => Promise<void>;
  /** Madde 2026-08-24: bu çağrı "Dersler" alt sekmesinin İÇİNDE mi? — bkz. yukarıdaki
   *  DERSLER_TITLE açıklaması. Kök seviyede (sekmenin ilk çağrısı) verilmez/false'tur;
   *  "Dersler" düğümünün kendisinden başlayarak TÜM alt düğümlere miras kalır. */
  inDersler?: boolean;
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
  tabId, parentId, allSections, depth, onSectionCreated, onSectionUpdated, onReloadTree,
  inDersler = false,
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
  const [duplicatingId, setDuplicatingId] = useState<number | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState('');

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
    await onReloadTree();
  }

  function startDuplicate(s: CustomTabSection) {
    setDuplicatingId(s.id);
    setDuplicateTitle('');
    setErr(null);
  }

  function cancelDuplicate() {
    setDuplicatingId(null);
    setDuplicateTitle('');
  }

  /** Madde 2026-08-22: bir bölümün İÇ İÇE YAPISINI (başlık+ikon, sınırsız
   *  derinlik) yeni bir KARDEŞ bölüme kopyalar — "Sınıf 1"i "Sınıf 2"ye
   *  uygulamak gibi tekrar eden içerik akışları için. Yazı/görsel BOŞ
   *  başlar, kopya sonrasında kaynaktan BAĞIMSIZDIR. */
  async function confirmDuplicate(id: number) {
    const title = duplicateTitle.trim();
    if (!title) { setErr('Yeni ad gerekli'); return; }
    setBusy(true); setErr(null);
    const created = await duplicateCustomTabSection(id, title);
    setBusy(false);
    if (!created) { setErr('Kopyalanamadı'); return; }
    cancelDuplicate();
    await onReloadTree();
  }

  /** Madde 2026-08-24: Alt Konu'da antrenörün kendi gösterimi için kaydettiği
   *  Kareye Tıkla/Taşa Tıkla/Taşı Oynat soruları — practice_positions'a
   *  benzer şekilde, sunucuya TÜM dizi PATCH edilir (Derslerdeki
   *  addExercise/updateExercise/deleteExercise ile AYNI desen). */
  async function addExercise(s: CustomTabSection, ex: BoardExercise) {
    const next = [...(s.board_exercises ?? []), ex];
    const ok = await updateCustomTabSection(s.id, { board_exercises: next });
    if (ok) onSectionUpdated(s.id, { board_exercises: next });
  }

  async function updateExerciseAt(s: CustomTabSection, idx: number, ex: BoardExercise) {
    const next = (s.board_exercises ?? []).map((e, i) => (i === idx ? ex : e));
    const ok = await updateCustomTabSection(s.id, { board_exercises: next });
    if (ok) onSectionUpdated(s.id, { board_exercises: next });
  }

  async function deleteExerciseAt(s: CustomTabSection, idx: number) {
    const next = (s.board_exercises ?? []).filter((_, i) => i !== idx);
    const ok = await updateCustomTabSection(s.id, { board_exercises: next });
    if (ok) onSectionUpdated(s.id, { board_exercises: next });
  }

  /** Madde 2026-08-26: Alt Konu'nun Konum Havuzu — her grup kendi kod
   *  numarasıyla eklenir, içinde numaralı adımlar (konum+cümle+hamle sırası)
   *  barındırır. AYNI TÜM-DİZİ-PATCH deseni. */
  async function addPositionPoolGroup(s: CustomTabSection, steps: PositionPoolStep[]) {
    const next = [...(s.position_pool ?? []), { id: crypto.randomUUID(), steps }];
    const ok = await updateCustomTabSection(s.id, { position_pool: next });
    if (ok) onSectionUpdated(s.id, { position_pool: next });
  }

  async function deletePositionPoolGroup(s: CustomTabSection, groupId: string) {
    const next = (s.position_pool ?? []).filter((g) => g.id !== groupId);
    const ok = await updateCustomTabSection(s.id, { position_pool: next });
    if (ok) onSectionUpdated(s.id, { position_pool: next });
  }

  async function reorderPositionPool(s: CustomTabSection, nextPool: PositionPoolEntry[]) {
    const ok = await updateCustomTabSection(s.id, { position_pool: nextPool });
    if (ok) onSectionUpdated(s.id, { position_pool: nextPool });
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
        // Madde 2026-08-24: "Dersler" ve TÜM altındaki düğümlerde Kopyala yok.
        const noDup = inDersler || s.title === DERSLER_TITLE;
        // Bu düğüm bir Alt Konu mu (Dersler altında 3. derinlik)? — evetse
        // kendi altına yeni alt sekme eklenemez, bunun yerine konum havuzu gösterilir.
        const isAltKonu = inDersler && depth === ALT_KONU_DEPTH;
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
              {!noDup && (
                <button type="button" onClick={() => startDuplicate(s)}
                  aria-label={`${s.title} yapısını kopyala`}
                  className="px-2 py-1 rounded-md text-amber-300 hover:bg-amber-400/10 text-xs">
                  Kopyala
                </button>
              )}
              <button type="button" onClick={() => remove(s.id)} disabled={busy}
                aria-label={`${s.title} alt sekmesini sil`}
                className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs disabled:opacity-40">
                Sil
              </button>
            </div>

            {!noDup && duplicatingId === s.id && (
              <div className="px-3 pb-3 space-y-2">
                <p className="text-xs n-muted">
                  &quot;{s.title}&quot; bölümünün İÇ İÇE YAPISI (başlıklar) yeni bir bölüme kopyalanır —
                  yazı/görsel boş başlar, kopyadan sonra bağımsızdır.
                </p>
                <input value={duplicateTitle} onChange={(e) => setDuplicateTitle(e.target.value)}
                  placeholder="Yeni bölümün adı (örn. Sınıf 2)" className="neon-input text-sm" />
                {err && <p className="text-rose-400 text-xs">{err}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={() => confirmDuplicate(s.id)}
                    disabled={busy || !duplicateTitle.trim()}
                    className="px-4 py-2 rounded-lg bg-amber-400/15 text-amber-200 border border-amber-400/50 hover:bg-amber-400/25 disabled:opacity-40 text-sm transition-colors">
                    Kopyala
                  </button>
                  <button type="button" onClick={cancelDuplicate}
                    className="px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-sm transition-colors">
                    Vazgeç
                  </button>
                </div>
              </div>
            )}

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

                {isAltKonu ? (
                  /* Madde 2026-08-26: Alt Konu'nun altına yeni alt sekme
                     eklenmez — bunun yerine Konum Havuzu (gruplu: kod +
                     numaralı adımlar) VE antrenörün kendi gösterimi için
                     Kareye Tıkla/Taşa Tıkla/Taşı Oynat soru ekleme alanı
                     BİRLİKTE gösterilir. */
                  <div className="pt-2 border-t border-white/10 space-y-4">
                    <AltKonuPositionPoolFields
                      pool={s.position_pool ?? []}
                      onAddGroup={(steps) => addPositionPoolGroup(s, steps)}
                      onDeleteGroup={(groupId) => deletePositionPoolGroup(s, groupId)}
                      onReorder={(nextPool) => reorderPositionPool(s, nextPool)}
                    />
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-xs font-bold n-muted uppercase tracking-widest mb-2">
                        Kareye Tıkla / Taşa Tıkla / Taşı Oynat
                      </p>
                      <AltKonuExercisesFields
                        exercises={s.board_exercises ?? []}
                        onAdd={(ex) => addExercise(s, ex)}
                        onUpdate={(idx, ex) => updateExerciseAt(s, idx, ex)}
                        onDelete={(idx) => deleteExerciseAt(s, idx)}
                      />
                    </div>
                  </div>
                ) : (
                  /* Bu bölümün KENDİ alt sekmeleri — iç içe (sınırsız derinlik).
                      Bu ic-ice cagri KENDI "+ Alt Sekme Ekle" formunu da (s'nin
                      cocuklari icin) HER ZAMAN gorunur sekilde cizer — bkz. asagida
                      bu bilesenin KENDI seviyesi icin aynı deseni tekrarlaması. */
                  <div className="pt-2 border-t border-white/10">
                    <NestedSectionTree
                      tabId={tabId} parentId={s.id} allSections={allSections}
                      depth={depth + 1}
                      onSectionCreated={onSectionCreated}
                      onSectionUpdated={onSectionUpdated}
                      onReloadTree={onReloadTree}
                      inDersler={noDup}
                    />
                  </div>
                )}
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
