'use client';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';
import { useSettings } from '@/lib/settings/settings-context';
import { DEFAULT_SETTINGS, mergeSettings, AppSettingsData } from '@/lib/settings/defaults';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const TAB_META: { key: keyof AppSettingsData['tabs']; label: string; desc: string }[] = [
  { key: 'play', label: 'Oyna', desc: 'Sporcu oyun (bot/online) ekranını görür' },
  { key: 'puzzle', label: 'Bulmaca', desc: 'Bulmaca sekmesi görünür' },
  { key: 'badges', label: 'Rozetler', desc: 'Rozetler sekmesi görünür' },
];

export default function AdminTabsPage() {
  const { reload } = useSettings();
  const [tabs, setTabs] = useState<AppSettingsData['tabs']>(DEFAULT_SETTINGS.tabs);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => { setTabs(mergeSettings(d).tabs); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function save(next: AppSettingsData['tabs']) {
    setSaving(true); setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tabs: next }),
    });
    setSaving(false);
    if (!r.ok) { setMsg('Kaydedilemedi'); return; }
    setMsg('Kaydedildi ✓');
    reload();
  }

  if (loading) return <p className="n-muted">Yükleniyor...</p>;

  const toggle = (k: keyof AppSettingsData['tabs']) => {
    const next = { ...tabs, [k]: !tabs[k] };
    setTabs(next);
    save(next);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1 n-text">Sekmeler</h1>
      <p className="text-sm n-muted mb-6">Hangi sekmeler sporcuda görünsün? Değişiklik anında yansır. (Dersler her zaman açıktır.)</p>
      {msg && <p className="text-sm text-cyan-300 mb-4">{msg}</p>}

      <div className="grid gap-3">
        {TAB_META.map((t) => (
          <div key={t.key} className="neon-card neon-cyan flex items-center gap-4 p-4">
            <div className="flex-1 min-w-0">
              <p className="font-semibold n-text">{t.label}</p>
              <p className="text-xs n-muted">{t.desc}</p>
            </div>
            <button
              onClick={() => toggle(t.key)}
              disabled={saving}
              aria-pressed={tabs[t.key]}
              className={`relative w-14 h-7 rounded-full transition-colors ${tabs[t.key] ? 'bg-cyan-400/40' : 'bg-white/10'}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${tabs[t.key] ? 'left-7' : 'left-0.5'}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
