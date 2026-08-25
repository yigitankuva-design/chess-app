'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth-storage';
import { useSettings } from '@/lib/settings/settings-context';
import { DEFAULT_SETTINGS, mergeSettings, ALL_TABS } from '@/lib/settings/defaults';
import type { AppSettingsData, TabKey } from '@/lib/settings/defaults';
import {
  listCustomTabs, createCustomTab, updateCustomTab, deleteCustomTab,
  getCustomTab, createCustomTabSection, deleteCustomTabSection, updateCustomTabSection,
} from '@/lib/customTabsApi';
import type { CustomTabSummary, CustomTabDetail } from '@/lib/customTabsApi';
import { compressImageToDataUri } from '@/lib/imageCompress';
import { PositionPoolFields } from '@/components/admin/PositionPoolFields';
import { CategorizedPositionPool } from '@/components/admin/CategorizedPositionPool';
import { OpeningCategoryCards } from '@/components/admin/OpeningCategoryCards';
import { FunActivityFields } from '@/components/admin/FunActivityFields';
import { PlaySettingsFields } from '@/components/admin/PlaySettingsFields';
import { NestedSectionTree } from '@/components/admin/NestedSectionTree';
import { IconPicker } from '@/components/admin/IconPicker';
import { InlineTitleEdit } from '@/components/admin/InlineTitleEdit';
import { START_FEN } from '@/components/BoardEditor';
import {
  PRATIK_YAP_LABEL, FIXED_SECTIONS, OYUNSONU_SECTION, KAZANC_SECTION,
  isFixedSection, sectionEmoji, sortPratikSections,
} from '@/lib/customTabs/pratikYap';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const TAB_META: Record<TabKey, { emoji: string; label: string; desc: string; color: string }> = {
  play:    { emoji: '🎮', label: 'Maç Yap',   color: '#34d399', desc: 'Bota karşı ve arkadaşla maç' },
  lessons: { emoji: '📚', label: 'Dersler',   color: '#38bdf8', desc: 'Düzey → Ders → Alt Konu → Pratik' },
  analiz:  { emoji: '🔍', label: 'Analiz Et', color: '#a78bfa', desc: 'Maç ve konum analizi' },
  eglence: { emoji: '🎉', label: 'Eğlence',   color: '#f472b6', desc: 'Bulmaca ve mini oyunlar' },
};

/** Zafer hocanın eklediği sekmelerin kart rengi — sporcu ana sayfasındaki
 *  CUSTOM_TAB_COLORS ile aynı sırada (app/(child)/home/page.tsx). */
const CUSTOM_TAB_COLORS = ['#fbbf24', '#2dd4bf', '#fb7185', '#60a5fa', '#c084fc'];

/**
 * Sekme açıldığında görünecek yönetim ekranı. null = henüz yönetim ekranı yok.
 * Yeni bir ekran hazır olduğunda buraya bir satır eklemek yeterlidir.
 */
const TAB_CONTENT: Record<TabKey, { href: string; emoji: string; title: string; desc: string } | null> = {
  lessons: { href: '/admin/content',  emoji: '📘', title: 'Ders İçeriği',   desc: 'Düzey, ders, alt konu ve soruları yönet' },
  // Açılış listesi artık "Pratik Yap" sekmesinin içindeki üç kartta yönetiliyor.
  play:    null,
  analiz:  null,
  eglence: null,
};

/** Maç Yap kartının 3 alt penceresi. Aynı anda tek pencere açık.
 *  "Açılış Pratiği Yap" artık burada değil — "Pratik Yap" özel sekmesine taşındı. */
const PLAY_SUBSECTIONS: { key: string; emoji: string; title: string;
  content: { href: string; emoji: string; title: string; desc: string } | null }[] = [
  { key: 'friend',     emoji: '🤝', title: 'Arkadaşınla Oyna',   content: null },
  { key: 'bot',        emoji: '🤖', title: 'Bota Karşı Oyna',    content: null },
  { key: 'tournament', emoji: '🏆', title: 'Turnuvaya Katıl',    content: null },
];

export default function AdminTabsPage() {
  const { reload } = useSettings();
  const [tabs, setTabs] = useState<AppSettingsData['tabs']>(DEFAULT_SETTINGS.tabs);
  const [order, setOrder] = useState<TabKey[]>(DEFAULT_SETTINGS.tabOrder);
  /** Madde 1 (2026-08-19): 4 sabit sekmenin ikon havuzundan seçilmiş ikonu. */
  const [icons, setIcons] = useState<AppSettingsData['labels']['icons']>(DEFAULT_SETTINGS.labels.icons);
  const [customTabs, setCustomTabs] = useState<CustomTabSummary[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newTabEmoji, setNewTabEmoji] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Tek seferde yalnızca bir kart açık (akordiyon) — sporcu ana sayfasıyla aynı dil.
   *  number ise özel (Zafer hocanın eklediği) bir sekmenin id'sidir. */
  const [openKey, setOpenKey] = useState<TabKey | number | null>(null);
  /** Maç Yap içindeki açık alt pencere; null = hepsi kapalı (tek-açık kuralı). */
  const [openPlaySub, setOpenPlaySub] = useState<string | null>(null);
  /** Açılan özel sekmenin alt sekmeleri (id'ye göre) — açılınca yüklenir. */
  const [customTabDetails, setCustomTabDetails] = useState<Record<number, CustomTabDetail>>({});
  /** Açık özel sekmenin içinde hangi alt sekme genişletilmiş. */
  const [openSectionId, setOpenSectionId] = useState<number | null>(null);
  /** "+ Alt Sekme Ekle" formu — o an açık olan özel sekmeye aittir. */
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionBody, setNewSectionBody] = useState('');
  const [newSectionImages, setNewSectionImages] = useState<string[]>([]);
  /** Düzenlenmekte olan alt sekme — null ise hiçbiri düzenlenmiyor. */
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  /** Konum havuzu düzenleme dizme alanı — açık alt sekmeye ait, geçici (kaydedilmemiş) taslak. */
  const [poolFen, setPoolFen] = useState(START_FEN);
  const [poolTurn, setPoolTurn] = useState<'w' | 'b'>('w');
  /** Madde 2026-09-05 (2+5): Maç Yap'ın gerçek oyun ayarları (bot seviyeleri/
   *  süre kontrolü/turnuva varsayılanları) — "⚙️ Maç Ayarları" alt bölümü
   *  kapatılıp açıldığında en güncel hâliyle görünsün diye kaydedince yeniden çekilir. */
  const [playSettings, setPlaySettings] = useState<AppSettingsData['play']>(DEFAULT_SETTINGS.play);

  const loadSettings = useCallback(() => {
    const token = getToken();
    return fetch(`${API_BASE}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        const s = mergeSettings(d);
        setTabs(s.tabs);
        setIcons(s.labels.icons);
        setPlaySettings(s.play);
        // Bozuk/eksik sırayı onar: bilinen sekmeler, eksikler sona
        const clean = (Array.isArray(s.tabOrder) ? s.tabOrder : []).filter((t): t is TabKey => ALL_TABS.includes(t as TabKey));
        setOrder([...clean, ...ALL_TABS.filter((t) => !clean.includes(t))]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    listCustomTabs().then(setCustomTabs);
  }, []);

  async function persist(nextTabs: AppSettingsData['tabs'], nextOrder: TabKey[]) {
    setSaving(true); setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tabs: nextTabs, tabOrder: nextOrder }),
    });
    setSaving(false);
    if (!r.ok) { setMsg('Kaydedilemedi'); return; }
    setMsg('Kaydedildi ✓');
    reload();
  }

  /** Madde 1 (2026-08-19): 4 sabit sekmeden birinin ikonu değişir. */
  async function saveTabIcon(key: TabKey, emoji: string) {
    const next = { ...icons, [key]: emoji };
    setIcons(next);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ labels: { icons: next } }),
    });
    if (!r.ok) { setMsg('Kaydedilemedi'); return; }
    setMsg('Kaydedildi ✓');
    reload();
  }

  async function addCustomTab() {
    const label = newLabel.trim();
    if (!label) { setMsg('Sekme adı gerekli'); return; }
    const created = await createCustomTab(label, newTabEmoji || undefined);
    if (!created) { setMsg('Eklenemedi'); return; }
    setCustomTabs((prev) => [...prev, created]);
    setNewLabel(''); setNewTabEmoji('');
    setMsg('Kaydedildi ✓');
  }

  /** Madde 1 (2026-08-19): mevcut özel sekmenin adı düzenlenir. */
  async function renameCustomTab(id: number, label: string): Promise<boolean> {
    const ok = await updateCustomTab(id, { label });
    if (ok) setCustomTabs((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)));
    return ok;
  }

  /** Madde 1/3 (2026-08-19): mevcut özel sekmenin ikonu ikon havuzundan değişir. */
  async function saveCustomTabIcon(id: number, emoji: string) {
    const ok = await updateCustomTab(id, { emoji });
    if (!ok) { setMsg('Kaydedilemedi'); return; }
    setCustomTabs((prev) => prev.map((c) => (c.id === id ? { ...c, emoji } : c)));
    setMsg('Kaydedildi ✓');
  }

  async function removeCustomTab(id: number) {
    const ok = await deleteCustomTab(id);
    if (!ok) { setMsg('Silinemedi'); return; }
    setCustomTabs((prev) => prev.filter((c) => c.id !== id));
    setMsg('Kaydedildi ✓');
  }

  /** Madde 2026-08-22: iç içe alt sekme ekle/düzenle/sil sonrası — yerel
   *  ağacı elle güncellemek yerine sunucudan taze (düz) listeyi çeker.
   *  Derinlik sınırsız olduğu için tekil patch'lemek yerine bu çok daha
   *  basit ve hatasız. */
  async function reloadCustomTabDetail(tabId: number) {
    const loaded = await getCustomTab(tabId);
    if (!loaded) return;
    setCustomTabDetails((prev) => ({ ...prev, [tabId]: loaded }));
  }

  function toggleCustomTab(id: number) {
    setOpenKey((prev) => (prev === id ? null : id));
    setOpenSectionId(null);
    setNewSectionTitle(''); setNewSectionBody(''); setNewSectionImages([]);
    cancelEditSection();
    setPoolFen(START_FEN); setPoolTurn('w');
    if (!customTabDetails[id]) {
      getCustomTab(id).then(async (loaded) => {
        if (!loaded) return;
        let detail = loaded;
        // "Pratik Yap" sekmesinde 3 sabit alt sekme HER ZAMAN bulunur; eksik
        // olanlar ilk açılışta oluşturulur (adına göre kontrol — iki kez oluşmaz).
        if (detail.label === PRATIK_YAP_LABEL) {
          for (const f of FIXED_SECTIONS) {
            if (detail.sections.some((s) => s.title === f.title)) continue;
            const created = await createCustomTabSection(id, f.title, '', []);
            if (created) detail = { ...detail, sections: [...detail.sections, created] };
          }
        }
        setCustomTabDetails((prev) => ({ ...prev, [id]: detail }));
      });
    }
  }

  async function onNewSectionImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const compressed = await Promise.all(Array.from(files).map((f) => compressImageToDataUri(f)));
    setNewSectionImages((prev) => [...prev, ...compressed]);
  }

  async function addAltSection(tabId: number) {
    const title = newSectionTitle.trim();
    if (!title) { setMsg('Alt sekme başlığı gerekli'); return; }
    const created = await createCustomTabSection(tabId, title, newSectionBody.trim(), newSectionImages);
    if (!created) { setMsg('Eklenemedi'); return; }
    setCustomTabDetails((prev) => {
      const existing = prev[tabId];
      if (!existing) return prev;
      return { ...prev, [tabId]: { ...existing, sections: [...existing.sections, created] } };
    });
    setNewSectionTitle(''); setNewSectionBody(''); setNewSectionImages([]);
    setMsg('Kaydedildi ✓');
  }

  function startEditSection(s: { id: number; title: string; body: string; images: string[] }) {
    setEditingSectionId(s.id);
    setEditTitle(s.title);
    setEditBody(s.body);
    setEditImages(s.images);
  }

  function cancelEditSection() {
    setEditingSectionId(null);
    setEditTitle(''); setEditBody(''); setEditImages([]);
  }

  async function onEditImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const compressed = await Promise.all(Array.from(files).map((f) => compressImageToDataUri(f)));
    setEditImages((prev) => [...prev, ...compressed]);
  }

  async function saveEditSection(tabId: number, sectionId: number) {
    const title = editTitle.trim();
    if (!title) { setMsg('Alt sekme başlığı gerekli'); return; }
    const patch = { title, body: editBody.trim(), images: editImages };
    const ok = await updateCustomTabSection(sectionId, patch);
    if (!ok) { setMsg('Kaydedilemedi'); return; }
    setCustomTabDetails((prev) => {
      const existing = prev[tabId];
      if (!existing) return prev;
      return {
        ...prev,
        [tabId]: {
          ...existing,
          sections: existing.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)),
        },
      };
    });
    cancelEditSection();
    setMsg('Kaydedildi ✓');
  }

  /**
   * fenOverride: FEN yapıştırma dalından gelir; yoksa elle dizilen konum kaydedilir.
   * category: yalnızca Oyunsonu Pratiği'nde dolu gelir (5 kategori kartı).
   */
  async function savePosition(
    tabId: number, sectionId: number, fenOverride?: string, category?: string, owner?: string,
  ) {
    const existing = customTabDetails[tabId]?.sections.find((s) => s.id === sectionId);
    if (!existing) return;
    const newPos = {
      id: crypto.randomUUID(),
      fen: fenOverride ?? poolFen,
      ...(category ? { category } : {}),
      ...(owner ? { owner } : {}),
    };
    const nextPool = [...existing.practice_positions, newPos];
    const ok = await updateCustomTabSection(sectionId, { practice_positions: nextPool });
    if (!ok) { setMsg('Kaydedilemedi'); return; }
    setCustomTabDetails((prev) => {
      const tab = prev[tabId];
      if (!tab) return prev;
      return {
        ...prev,
        [tabId]: {
          ...tab,
          sections: tab.sections.map((s) => (s.id === sectionId ? { ...s, practice_positions: nextPool } : s)),
        },
      };
    });
    setPoolFen(START_FEN); setPoolTurn('w');
    setMsg('Kaydedildi ✓');
  }

  /** Havuzdaki bir konumu düzenleyip yeniden kaydeder (kodu değişmez). */
  async function updatePosition(
    tabId: number, sectionId: number, positionId: string,
    next: { id: string; fen: string; category?: string | null; code?: string; owner?: string | null },
  ) {
    const existing = customTabDetails[tabId]?.sections.find((s) => s.id === sectionId);
    if (!existing) return;
    const nextPool = existing.practice_positions.map((p) => (p.id === positionId ? next : p));
    const ok = await updateCustomTabSection(sectionId, { practice_positions: nextPool });
    if (!ok) { setMsg('Kaydedilemedi'); return; }
    setCustomTabDetails((prev) => {
      const tab = prev[tabId];
      if (!tab) return prev;
      return {
        ...prev,
        [tabId]: {
          ...tab,
          sections: tab.sections.map((s) => (s.id === sectionId ? { ...s, practice_positions: nextPool } : s)),
        },
      };
    });
    setMsg('Kaydedildi ✓');
  }

  async function deletePosition(tabId: number, sectionId: number, positionId: string) {
    const existing = customTabDetails[tabId]?.sections.find((s) => s.id === sectionId);
    if (!existing) return;
    const nextPool = existing.practice_positions.filter((p) => p.id !== positionId);
    const ok = await updateCustomTabSection(sectionId, { practice_positions: nextPool });
    if (!ok) { setMsg('Silinemedi'); return; }
    setCustomTabDetails((prev) => {
      const tab = prev[tabId];
      if (!tab) return prev;
      return {
        ...prev,
        [tabId]: {
          ...tab,
          sections: tab.sections.map((s) => (s.id === sectionId ? { ...s, practice_positions: nextPool } : s)),
        },
      };
    });
    setMsg('Kaydedildi ✓');
  }

  async function removeAltSection(tabId: number, sectionId: number) {
    const ok = await deleteCustomTabSection(sectionId);
    if (!ok) { setMsg('Silinemedi'); return; }
    setCustomTabDetails((prev) => {
      const existing = prev[tabId];
      if (!existing) return prev;
      return { ...prev, [tabId]: { ...existing, sections: existing.sections.filter((s) => s.id !== sectionId) } };
    });
    setMsg('Kaydedildi ✓');
  }

  /** Madde 3 (2026-08-19): alt sekmenin ikonu değişir — sabit sekmeler
   *  (Kazanç/Oyunsonu) dahil, başlık/silme kilidinden BAĞIMSIZ. */
  async function saveSectionIcon(tabId: number, sectionId: number, emoji: string) {
    const ok = await updateCustomTabSection(sectionId, { emoji });
    if (!ok) { setMsg('Kaydedilemedi'); return; }
    setCustomTabDetails((prev) => {
      const tab = prev[tabId];
      if (!tab) return prev;
      return {
        ...prev,
        [tabId]: { ...tab, sections: tab.sections.map((s) => (s.id === sectionId ? { ...s, emoji } : s)) },
      };
    });
    setMsg('Kaydedildi ✓');
  }

  function move(key: TabKey, dir: -1 | 1) {
    const visible = order.filter((t) => tabs[t] !== false);
    const i = visible.indexOf(key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= visible.length) return;
    [visible[i], visible[j]] = [visible[j], visible[i]];
    const next = [...visible, ...order.filter((t) => tabs[t] === false)];
    setOrder(next);
    persist(tabs, next);
  }

  function setVisible(key: TabKey, on: boolean) {
    const nextTabs = { ...tabs, [key]: on };
    setTabs(nextTabs);
    persist(nextTabs, order);
  }

  if (loading) return <p className="n-muted">Yükleniyor...</p>;

  const shown = order.filter((t) => tabs[t] !== false);
  const removed = order.filter((t) => tabs[t] === false);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1 n-text">Sekmeler</h1>
      <p className="text-sm n-muted mb-6">
        Sporcu ekranındaki sekmeleri ekleyip kaldırabilir, sıralarını değiştirebilirsin.
        Değişiklikler anında yansır.
      </p>
      {msg && <p className="text-sm text-cyan-300 mb-4">{msg}</p>}

      {/* ── Ekranda görünen sekmeler ── */}
      <p className="text-xs font-bold n-muted uppercase tracking-widest mb-2">
        Sporcuda görünen sekmeler ({shown.length + customTabs.length})
      </p>
      <div className="grid gap-3 mb-8">
        {shown.length === 0 && customTabs.length === 0 && (
          <p className="text-sm n-muted">Hiç sekme yok. Aşağıdan ekleyebilirsin.</p>
        )}
        {shown.map((key, idx) => {
          const m = TAB_META[key];
          const open = openKey === key;
          const content = TAB_CONTENT[key];
          return (
            <div key={key} className="neon-card p-4" style={{ borderColor: m.color }}>
              <div className="flex items-center gap-3">
                <IconPicker
                  value={icons[key] || m.emoji}
                  onChange={(emoji) => saveTabIcon(key, emoji)}
                  ariaLabel={`${m.label} ikonunu değiştir`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold n-text" style={{ color: m.color }}>{idx + 1}. {m.label}</p>
                  <p className="text-xs n-muted">{m.desc}</p>
                </div>
                <button onClick={() => move(key, -1)} disabled={idx === 0 || saving}
                  aria-label="Yukarı taşı"
                  className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↑</button>
                <button onClick={() => move(key, 1)} disabled={idx === shown.length - 1 || saving}
                  aria-label="Aşağı taşı"
                  className="px-2 py-1 rounded-md bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-30 text-xs">↓</button>
                <button onClick={() => setVisible(key, false)} disabled={saving}
                  className="px-2.5 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs disabled:opacity-40">
                  Kaldır
                </button>
              </div>

              {/* Dairesel AÇ / KAPAT düğmesi — kartın ortasında */}
              <div className="flex justify-center mt-3">
                <button
                  type="button"
                  onClick={() => setOpenKey((prev) => (prev === key ? null : key))}
                  aria-expanded={open}
                  aria-label={`${m.label} sekmesini ${open ? 'kapat' : 'aç'}`}
                  className="flex items-center justify-center rounded-full font-bold transition-colors"
                  style={{
                    width: 60,
                    height: 60,
                    fontSize: '0.975rem',  // %50 buyutuldu (0.65 -> 0.975)
                    letterSpacing: '0.04em',
                    border: `2px solid ${m.color}`,
                    color: m.color,
                    background: open ? `${m.color}26` : 'transparent',
                  }}
                >
                  {open ? 'KAPAT' : 'AÇ'}
                </button>
              </div>

              {/* Sekmenin yönetim ekranı — yalnızca açıkken */}
              {open && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  {key === 'eglence' ? (
                    <FunActivityFields />
                  ) : key === 'play' ? (
                    <div className="space-y-2">
                      {PLAY_SUBSECTIONS.map((sub) => {
                        const subOpen = openPlaySub === sub.key;
                        return (
                          <div key={sub.key} className="rounded-lg border border-white/10 bg-white/[0.03]">
                            <button type="button"
                              onClick={() => setOpenPlaySub((p) => (p === sub.key ? null : sub.key))}
                              aria-expanded={subOpen}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors">
                              <span className="text-lg leading-none">{sub.emoji}</span>
                              <span className="text-sm font-semibold n-text flex-1">{sub.title}</span>
                              <span className="text-xs n-muted">{subOpen ? '▴' : '▾'}</span>
                            </button>
                            {subOpen && (
                              <div className="px-3 pb-3">
                                {sub.content ? (
                                  <Link href={sub.content.href}
                                    className="flex items-center gap-3 p-3 rounded-lg hover:brightness-125 transition-all"
                                    style={{ background: `${m.color}1a`, border: `1px solid ${m.color}66` }}>
                                    <span className="text-xl leading-none">{sub.content.emoji}</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold" style={{ color: m.color }}>{sub.content.title}</p>
                                      <p className="text-xs n-muted">{sub.content.desc}</p>
                                    </div>
                                    <span className="text-sm" style={{ color: m.color }}>→</span>
                                  </Link>
                                ) : (
                                  <p className="text-sm n-muted">
                                    İçerik yönetimi yakında — bu bölüm için ekran hazırlanıyor.
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="rounded-lg border border-white/10 bg-white/[0.03]">
                        <button type="button"
                          onClick={() => setOpenPlaySub((p) => (p === 'settings' ? null : 'settings'))}
                          aria-expanded={openPlaySub === 'settings'}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors">
                          <span className="text-lg leading-none">⚙️</span>
                          <span className="text-sm font-semibold n-text flex-1">Maç Ayarları</span>
                          <span className="text-xs n-muted">{openPlaySub === 'settings' ? '▴' : '▾'}</span>
                        </button>
                        {openPlaySub === 'settings' && (
                          <div className="px-3 pb-3">
                            <PlaySettingsFields play={playSettings} onSaved={() => { reload(); loadSettings(); }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : content ? (
                    <Link href={content.href}
                      className="flex items-center gap-3 p-3 rounded-lg hover:brightness-125 transition-all"
                      style={{ background: `${m.color}1a`, border: `1px solid ${m.color}66` }}>
                      <span className="text-xl leading-none">{content.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: m.color }}>{content.title}</p>
                        <p className="text-xs n-muted">{content.desc}</p>
                      </div>
                      <span className="text-sm" style={{ color: m.color }}>→</span>
                    </Link>
                  ) : (
                    <p className="text-sm n-muted">
                      İçerik yönetimi yakında — bu sekme için ekleme/düzenleme ekranı hazırlanıyor.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Zafer hocanın eklediği sekmeler — diğerleriyle AYNI listede ve AYNI
            görünümde (numaralı, dairesel AÇ/KAPAT) gösterilir (kullanıcı kararı). */}
        {customTabs.map((c, i) => {
          const idx = shown.length + i;
          const color = CUSTOM_TAB_COLORS[i % CUSTOM_TAB_COLORS.length];
          const open = openKey === c.id;
          const detail = customTabDetails[c.id];
          const isPratikYap = c.label === 'Pratik Yap';
          return (
            <div key={c.id} className="neon-card p-4" style={{ borderColor: color }}>
              <div className="flex items-center gap-3">
                <IconPicker
                  value={c.emoji}
                  onChange={(emoji) => saveCustomTabIcon(c.id, emoji)}
                  ariaLabel={`${c.label} ikonunu değiştir`}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold n-text" style={{ color }}>
                    {idx + 1}.{' '}
                    <InlineTitleEdit
                      value={c.label}
                      onSave={(next) => renameCustomTab(c.id, next)}
                      ariaLabel={`${c.label} sekme adını düzenle`}
                    />
                  </p>
                  <p className="text-xs n-muted">Zafer hocanın eklediği sekme</p>
                </div>
                <button onClick={() => removeCustomTab(c.id)}
                  className="px-2.5 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">
                  Kaldır
                </button>
              </div>

              {/* Dairesel AÇ / KAPAT düğmesi — yerleşik sekmelerle aynı */}
              <div className="flex justify-center mt-3">
                <button
                  type="button"
                  onClick={() => toggleCustomTab(c.id)}
                  aria-expanded={open}
                  aria-label={`${c.label} sekmesini ${open ? 'kapat' : 'aç'}`}
                  className="flex items-center justify-center rounded-full font-bold transition-colors"
                  style={{
                    width: 60,
                    height: 60,
                    fontSize: '0.975rem',
                    letterSpacing: '0.04em',
                    border: `2px solid ${color}`,
                    color,
                    background: open ? `${color}26` : 'transparent',
                  }}
                >
                  {open ? 'KAPAT' : 'AÇ'}
                </button>
              </div>

              {open && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                  {isPratikYap && <OpeningCategoryCards color={color} />}

                  {!detail ? (
                    <p className="text-sm n-muted">Yükleniyor...</p>
                  ) : !isPratikYap ? (
                    /* Madde 2026-08-22: Pratik Yap DIŞINDAKİ özel sekmeler artık İÇ İÇE
                       (sınırsız derinlikte) alt sekme ağacı kullanır — "Antrenör" sekmesi/
                       "Sınıflar" ihtiyacı. Pratik Yap kendi sabit-bölüm mantığını (Kazanç/
                       Oyunsonu, konum havuzları) AŞAĞIDA DEĞİŞMEDEN korur. */
                    <NestedSectionTree
                      tabId={c.id} parentId={null} allSections={detail.sections} depth={0}
                      onSectionCreated={(section) => setCustomTabDetails((prev) => {
                        const existing = prev[c.id];
                        if (!existing) return prev;
                        return { ...prev, [c.id]: { ...existing, sections: [...existing.sections, section] } };
                      })}
                      onSectionUpdated={(id, patch) => setCustomTabDetails((prev) => {
                        const existing = prev[c.id];
                        if (!existing) return prev;
                        return {
                          ...prev,
                          [c.id]: {
                            ...existing,
                            sections: existing.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
                          },
                        };
                      })}
                      onReloadTree={() => reloadCustomTabDetail(c.id)}
                    />
                  ) : (
                    <>
                      {detail.sections.length === 0 && !isPratikYap && (
                        <p className="text-sm n-muted">Henüz alt sekme yok. Aşağıdan ekleyebilirsin.</p>
                      )}
                      {(isPratikYap ? sortPratikSections(detail.sections) : detail.sections).map((s) => {
                        const sOpen = openSectionId === s.id;
                        const isEditing = editingSectionId === s.id;
                        // Sabit sekmeler (Kazanç/Oyunsonu) adı değiştirilemez ve silinemez.
                        const fixed = isPratikYap && isFixedSection(s.title);
                        // Madde 3 (2026-08-19): admin ikon seçtiyse (s.emoji) o kullanılır;
                        // seçmediyse eski varsayılana (Kazanç/Oyunsonu → 🏆/🏁) düşer.
                        const emoji = s.emoji || (isPratikYap ? sectionEmoji(s.title) : null);
                        return (
                          <div key={s.id} className="rounded-lg border border-white/10 bg-white/[0.03]">
                            <div className="flex items-center gap-2 px-3 py-2.5">
                              <IconPicker
                                value={emoji}
                                onChange={(next) => saveSectionIcon(c.id, s.id, next)}
                                size={30}
                                ariaLabel={`${s.title} ikonunu değiştir`}
                              />
                              <button type="button"
                                onClick={() => setOpenSectionId((p) => (p === s.id ? null : s.id))}
                                aria-expanded={sOpen}
                                className="flex-1 flex items-center gap-2 text-left hover:bg-white/5 transition-colors">
                                <span className="text-sm font-semibold n-text flex-1">
                                  {s.title}
                                </span>
                                <span className="text-xs n-muted">{sOpen ? '▴' : '▾'}</span>
                              </button>
                              {!fixed && (
                                <>
                                  <button type="button" onClick={() => startEditSection(s)}
                                    aria-label={`${s.title} alt sekmesini düzenle`}
                                    className="px-2 py-1 rounded-md text-cyan-300 hover:bg-cyan-400/10 text-xs">
                                    Düzenle
                                  </button>
                                  <button type="button" onClick={() => removeAltSection(c.id, s.id)}
                                    aria-label={`${s.title} alt sekmesini sil`}
                                    className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">
                                    Sil
                                  </button>
                                </>
                              )}
                            </div>
                            {isEditing ? (
                              <div className="px-3 pb-3 space-y-2">
                                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                                  placeholder="Alt sekme başlığı" className="neon-input text-sm" />
                                <textarea value={editBody} onChange={(e) => setEditBody(e.target.value)}
                                  placeholder="Yazı" rows={3} className="neon-input text-sm" />
                                <input type="file" accept="image/*" multiple className="hidden" id={`edit-section-image-${s.id}`}
                                  onChange={(e) => onEditImageFiles(e.target.files)} />
                                <label htmlFor={`edit-section-image-${s.id}`}
                                  className="inline-block px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
                                  Bilgisayardan Seç
                                </label>
                                {editImages.length > 0 && (
                                  <div className="flex gap-2 flex-wrap">
                                    {editImages.map((uri, imgI) => (
                                      <img key={imgI} src={uri} alt={`Görsel ${imgI + 1}`}
                                        style={{ maxWidth: 60, maxHeight: 45, objectFit: 'contain' }} />
                                    ))}
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <button type="button" onClick={() => saveEditSection(c.id, s.id)} disabled={!editTitle.trim()}
                                    className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-sm transition-colors">
                                    Kaydet
                                  </button>
                                  <button type="button" onClick={cancelEditSection}
                                    className="px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-sm transition-colors">
                                    Vazgeç
                                  </button>
                                </div>
                              </div>
                            ) : sOpen && (
                              <div className="px-3 pb-3 space-y-2">
                                {s.body && <p className="text-sm n-muted whitespace-pre-wrap">{s.body}</p>}
                                {s.images.length > 0 && (
                                  <div className="flex gap-2 flex-wrap">
                                    {s.images.map((uri, imgI) => (
                                      <img key={imgI} src={uri} alt={`${s.title} görseli ${imgI + 1}`}
                                        style={{ maxWidth: 80, maxHeight: 60, objectFit: 'contain' }} />
                                    ))}
                                  </div>
                                )}
                                {isPratikYap && (
                                  <div className="pt-2 border-t border-white/10">
                                    {s.title === OYUNSONU_SECTION ? (
                                      /* Oyunsonu: konumlar 5 kategoriye ayrılır. */
                                      <CategorizedPositionPool
                                        fen={poolFen} turn={poolTurn}
                                        onFenChange={setPoolFen} onTurnChange={setPoolTurn}
                                        onSavePosition={(f, cat) => savePosition(c.id, s.id, f, cat)}
                                        pool={s.practice_positions}
                                        onDeletePosition={(posId) => deletePosition(c.id, s.id, posId)}
                                        onUpdatePosition={(posId, next) => updatePosition(c.id, s.id, posId, next)}
                                      />
                                    ) : (
                                      <PositionPoolFields
                                        fen={poolFen} turn={poolTurn}
                                        onFenChange={setPoolFen} onTurnChange={setPoolTurn}
                                        onSavePosition={(f, owner) => savePosition(c.id, s.id, f, undefined, owner)}
                                        pool={s.practice_positions}
                                        onDeletePosition={(posId) => deletePosition(c.id, s.id, posId)}
                                        onUpdatePosition={(posId, next) => updatePosition(c.id, s.id, posId, next)}
                                        showOwnerField={s.title === KAZANC_SECTION}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-2">
                        <p className="text-xs font-bold n-muted uppercase tracking-widest">+ Alt Sekme Ekle</p>
                        <input value={newSectionTitle} onChange={(e) => setNewSectionTitle(e.target.value)}
                          placeholder="Alt sekme başlığı" className="neon-input text-sm" />
                        <textarea value={newSectionBody} onChange={(e) => setNewSectionBody(e.target.value)}
                          placeholder="Yazı" rows={3} className="neon-input text-sm" />
                        <input type="file" accept="image/*" multiple className="hidden" id={`new-section-image-${c.id}`}
                          onChange={(e) => onNewSectionImageFiles(e.target.files)} />
                        <label htmlFor={`new-section-image-${c.id}`}
                          className="inline-block px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer">
                          Bilgisayardan Seç
                        </label>
                        {newSectionImages.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {newSectionImages.map((uri, imgI) => (
                              <img key={imgI} src={uri} alt={`Yeni görsel ${imgI + 1}`}
                                style={{ maxWidth: 60, maxHeight: 45, objectFit: 'contain' }} />
                            ))}
                          </div>
                        )}
                        <button onClick={() => addAltSection(c.id)} disabled={!newSectionTitle.trim()}
                          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-40 text-sm transition-colors">
                          Alt sekme ekle
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Yeni sekme ekleme ── */}
      <div className="neon-card neon-green p-5 mb-8">
        <h2 className="font-bold mb-1 n-text">+ Yeni Sekme Ekle</h2>
        <p className="text-xs n-muted mb-4">
          Sekmeye bir ad ver. Yukarıdaki listede görünür — AÇ&apos;a basıp içine
          alt sekmeler (başlık/yazı/görsel) ekleyebilirsin.
        </p>
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <div>
            <label className="text-xs n-muted block mb-1">İkon</label>
            <IconPicker value={newTabEmoji} onChange={setNewTabEmoji} ariaLabel="Yeni sekmenin ikonunu seç" />
          </div>
          <div>
            <label className="text-xs n-muted block mb-1">Sekme adı</label>
            <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              placeholder="örn. Bulmacalar" className="neon-input w-full" />
          </div>
          <button onClick={addCustomTab} disabled={!newLabel.trim()}
            className="px-4 py-2 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 text-sm disabled:opacity-40 transition-colors">
            Ekle
          </button>
        </div>
      </div>

      {/* ── Kaldırılan sekmeler ── */}
      <p className="text-xs font-bold n-muted uppercase tracking-widest mb-2">
        Kaldırılan sekmeler ({removed.length})
      </p>
      {removed.length === 0 ? (
        <p className="text-sm n-muted">Kaldırılan sekme yok — hepsi sporcuda görünüyor.</p>
      ) : (
        <div className="grid gap-2">
          {removed.map((key) => {
            const m = TAB_META[key];
            return (
              <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10">
                <span className="text-xl leading-none opacity-50">{m.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold n-muted">{m.label}</p>
                  <p className="text-xs n-muted">{m.desc}</p>
                </div>
                <button onClick={() => setVisible(key, true)} disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25 text-xs disabled:opacity-40">
                  + Ekle
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
