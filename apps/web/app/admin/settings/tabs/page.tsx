'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getToken } from '@/lib/auth-storage';
import { useSettings } from '@/lib/settings/settings-context';
import { DEFAULT_SETTINGS, mergeSettings, ALL_TABS } from '@/lib/settings/defaults';
import type { AppSettingsData, TabKey } from '@/lib/settings/defaults';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const TAB_META: Record<TabKey, { emoji: string; label: string; desc: string; color: string }> = {
  play:    { emoji: '🎮', label: 'Maç Yap',   color: '#34d399', desc: 'Bota karşı ve arkadaşla maç' },
  lessons: { emoji: '📚', label: 'Dersler',   color: '#38bdf8', desc: 'Düzey → Ders → Alt Konu → Pratik' },
  analiz:  { emoji: '🔍', label: 'Analiz Et', color: '#a78bfa', desc: 'Maç ve konum analizi' },
  eglence: { emoji: '🎉', label: 'Eğlence',   color: '#f472b6', desc: 'Bulmaca ve mini oyunlar' },
};

export default function AdminTabsPage() {
  const { reload } = useSettings();
  const [tabs, setTabs] = useState<AppSettingsData['tabs']>(DEFAULT_SETTINGS.tabs);
  const [order, setOrder] = useState<TabKey[]>(DEFAULT_SETTINGS.tabOrder);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

              {/* Dersler sekmesinin içeriği buradan yönetilir */}
              {key === 'lessons' && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <Link href="/admin/content"
                    className="flex items-center gap-3 p-3 rounded-lg bg-cyan-400/10 border border-cyan-400/40 hover:bg-cyan-400/20 transition-colors">
                    <span className="text-xl leading-none">📘</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-cyan-200">Ders İçeriği</p>
                      <p className="text-xs n-muted">Düzey, ders, alt konu ve soruları yönet</p>
                    </div>
                    <span className="text-cyan-300 text-sm">→</span>
                  </Link>
                </div>
              )}
            </div>
          );
        })}
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
