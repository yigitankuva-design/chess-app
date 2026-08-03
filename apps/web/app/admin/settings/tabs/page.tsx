'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth-storage';
import { useSettings } from '@/lib/settings/settings-context';
import { DEFAULT_SETTINGS, mergeSettings, ALL_TABS } from '@/lib/settings/defaults';
import type { AppSettingsData, TabKey } from '@/lib/settings/defaults';
import { listCustomTabs, createCustomTab, deleteCustomTab } from '@/lib/customTabsApi';
import type { CustomTabSummary } from '@/lib/customTabsApi';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const TAB_META: Record<TabKey, { emoji: string; label: string; desc: string; color: string }> = {
  play:    { emoji: '🎮', label: 'Maç Yap',   color: '#34d399', desc: 'Bota karşı ve arkadaşla maç' },
  lessons: { emoji: '📚', label: 'Dersler',   color: '#38bdf8', desc: 'Düzey → Ders → Alt Konu → Pratik' },
  analiz:  { emoji: '🔍', label: 'Analiz Et', color: '#a78bfa', desc: 'Maç ve konum analizi' },
  eglence: { emoji: '🎉', label: 'Eğlence',   color: '#f472b6', desc: 'Bulmaca ve mini oyunlar' },
};

/**
 * Sekme açıldığında görünecek yönetim ekranı. null = henüz yönetim ekranı yok.
 * Yeni bir ekran hazır olduğunda buraya bir satır eklemek yeterlidir.
 */
const TAB_CONTENT: Record<TabKey, { href: string; emoji: string; title: string; desc: string } | null> = {
  lessons: { href: '/admin/content',  emoji: '📘', title: 'Ders İçeriği',   desc: 'Düzey, ders, alt konu ve soruları yönet' },
  play:    { href: '/admin/openings', emoji: '📖', title: 'Açılış Listesi', desc: 'Açılış pratiği için açılış ekle ve kaldır' },
  analiz:  null,
  eglence: null,
};

/** Maç Yap kartının 4 alt penceresi. Aynı anda tek pencere açık.
 *  Açılış Listesi yönetimi "Açılış Pratiği Yap"ın altındadır; diğerleri iskelet. */
const PLAY_SUBSECTIONS: { key: string; emoji: string; title: string;
  content: { href: string; emoji: string; title: string; desc: string } | null }[] = [
  { key: 'friend',     emoji: '🤝', title: 'Arkadaşınla Oyna',   content: null },
  { key: 'bot',        emoji: '🤖', title: 'Bota Karşı Oyna',    content: null },
  { key: 'opening',    emoji: '📖', title: 'Açılış Pratiği Yap',
    content: { href: '/admin/openings', emoji: '📖', title: 'Açılış Listesi',
               desc: 'Açılış pratiği için açılış ekle ve kaldır' } },
  { key: 'tournament', emoji: '🏆', title: 'Turnuvaya Katıl',    content: null },
];

export default function AdminTabsPage() {
  const { reload } = useSettings();
  const [tabs, setTabs] = useState<AppSettingsData['tabs']>(DEFAULT_SETTINGS.tabs);
  const [order, setOrder] = useState<TabKey[]>(DEFAULT_SETTINGS.tabOrder);
  const [customTabs, setCustomTabs] = useState<CustomTabSummary[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Tek seferde yalnızca bir kart açık (akordiyon) — sporcu ana sayfasıyla aynı dil. */
  const [openKey, setOpenKey] = useState<TabKey | null>(null);
  /** Maç Yap içindeki açık alt pencere; null = hepsi kapalı (tek-açık kuralı). */
  const [openPlaySub, setOpenPlaySub] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => {
        const s = mergeSettings(d);
        setTabs(s.tabs);
        // Bozuk/eksik sırayı onar: bilinen sekmeler, eksikler sona
        const clean = (Array.isArray(s.tabOrder) ? s.tabOrder : []).filter((t): t is TabKey => ALL_TABS.includes(t as TabKey));
        setOrder([...clean, ...ALL_TABS.filter((t) => !clean.includes(t))]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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

  async function addCustomTab() {
    const label = newLabel.trim();
    if (!label) { setMsg('Sekme adı gerekli'); return; }
    const created = await createCustomTab(label);
    if (!created) { setMsg('Eklenemedi'); return; }
    setCustomTabs((prev) => [...prev, created]);
    setNewLabel('');
    setMsg('Kaydedildi ✓');
  }

  async function removeCustomTab(id: number) {
    const ok = await deleteCustomTab(id);
    if (!ok) { setMsg('Silinemedi'); return; }
    setCustomTabs((prev) => prev.filter((c) => c.id !== id));
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
        Sporcuda görünen sekmeler ({shown.length})
      </p>
      <div className="grid gap-3 mb-8">
        {shown.length === 0 && (
          <p className="text-sm n-muted">Hiç sekme yok. Aşağıdan ekleyebilirsin.</p>
        )}
        {shown.map((key, idx) => {
          const m = TAB_META[key];
          const open = openKey === key;
          const content = TAB_CONTENT[key];
          return (
            <div key={key} className="neon-card p-4" style={{ borderColor: m.color }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl leading-none">{m.emoji}</span>
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
                  {key === 'play' ? (
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
      </div>

      {/* ── Yeni sekme ekleme ── */}
      <div className="neon-card neon-green p-5 mb-8">
        <h2 className="font-bold mb-1 n-text">+ Yeni Sekme Ekle</h2>
        <p className="text-xs n-muted mb-4">
          Sekmeye bir ad ver. Kendi sayfası oluşur, içeriğini (başlık/yazı/görsel
          bölümleri) &quot;İçeriği düzenle&quot; linkinden doldurabilirsin.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
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

        {customTabs.length > 0 && (
          <div className="grid gap-2 mt-4">
            {customTabs.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10">
                <span className="text-xl leading-none">{c.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold n-text">{c.label}</p>
                </div>
                <Link href={`/admin/custom-tabs/${c.id}`}
                  className="px-3 py-1.5 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 text-xs transition-colors">
                  İçeriği düzenle
                </Link>
                <button onClick={() => removeCustomTab(c.id)}
                  className="px-2.5 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">
                  Kaldır
                </button>
              </div>
            ))}
          </div>
        )}
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
