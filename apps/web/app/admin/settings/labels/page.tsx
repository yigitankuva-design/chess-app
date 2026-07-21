'use client';
import { useEffect, useState } from 'react';
import { getToken } from '@/lib/auth-storage';
import { useSettings } from '@/lib/settings/settings-context';
import { DEFAULT_SETTINGS, mergeSettings, AppSettingsData } from '@/lib/settings/defaults';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function AdminLabelsPage() {
  const { reload } = useSettings();
  const [labels, setLabels] = useState<AppSettingsData['labels']>(DEFAULT_SETTINGS.labels);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = getToken();
    fetch(`${API_BASE}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => { setLabels(mergeSettings(d).labels); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function save(next: AppSettingsData['labels']) {
    setSaving(true); setMsg(null);
    const token = getToken();
    const r = await fetch(`${API_BASE}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ labels: next }),
    });
    setSaving(false);
    if (!r.ok) { setMsg('Kaydedilemedi'); return; }
    setMsg('Kaydedildi ✓');
    reload();
  }

  if (loading) return <p className="n-muted">Yükleniyor...</p>;

  const setLevel = (k: string, v: string) => setLabels({ ...labels, levels: { ...labels.levels, [k]: v } });
  const setFeature = (k: keyof AppSettingsData['labels']['features'], v: string) =>
    setLabels({ ...labels, features: { ...labels.features, [k]: v } });
  const setSection = (k: keyof AppSettingsData['labels']['sections'], v: string) =>
    setLabels({ ...labels, sections: { ...labels.sections, [k]: v } });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-1 n-text">Yazılar & Etiketler</h1>
      <p className="text-sm n-muted mb-6">Buradaki değişiklikler sporcu ekranına otomatik yansır.</p>
      {msg && <p className="text-sm text-cyan-300 mb-4">{msg}</p>}

      <div className="neon-card neon-cyan p-5 mb-4">
        <h2 className="font-bold mb-3 n-text">Düzey Adları</h2>
        <div className="grid gap-2">
          {['1', '2', '3', '4'].map((k) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-6 text-center n-muted text-sm">{k}</span>
              <input className="neon-input flex-1" value={labels.levels[k] ?? ''}
                onChange={(e) => setLevel(k, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className="neon-card neon-purple p-5 mb-4">
        <h2 className="font-bold mb-3 n-text">Buton Yazıları</h2>
        <div className="grid gap-2">
          {([['play', 'Maç Yap'], ['lessons', 'Dersler'], ['analiz', 'Analiz Et'], ['eglence', 'Eğlence']] as const).map(([k, hint]) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-24 n-muted text-xs">{hint}</span>
              <input className="neon-input flex-1" value={labels.features[k] ?? ''}
                onChange={(e) => setFeature(k, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className="neon-card neon-green p-5 mb-4">
        <h2 className="font-bold mb-3 n-text">Bölüm Başlıkları</h2>
        <div className="grid gap-2">
          {([['quickAccess', 'Hızlı Erişim'], ['lessonsPick', 'Düzey Seç']] as const).map(([k, hint]) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-24 n-muted text-xs">{hint}</span>
              <input className="neon-input flex-1" value={labels.sections[k] ?? ''}
                onChange={(e) => setSection(k, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => save(labels)} disabled={saving}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 text-sm transition-colors">
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        <button onClick={() => { setLabels(DEFAULT_SETTINGS.labels); save(DEFAULT_SETTINGS.labels); }}
          className="px-4 py-2 rounded-lg bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 text-sm transition-colors">
          Varsayılana dön
        </button>
      </div>
    </div>
  );
}
