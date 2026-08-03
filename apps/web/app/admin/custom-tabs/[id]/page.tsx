'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  getCustomTab, createCustomTabSection, deleteCustomTabSection,
} from '@/lib/customTabsApi';
import type { CustomTabDetail } from '@/lib/customTabsApi';
import { compressImageToDataUri } from '@/lib/imageCompress';

export default function AdminCustomTabPage() {
  const params = useParams();
  const router = useRouter();
  const tabId = Number(params.id);
  const [tab, setTab] = useState<CustomTabDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newImages, setNewImages] = useState<string[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const detail = await getCustomTab(tabId);
    setTab(detail);
    setLoading(false);
  }, [tabId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function onImageFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const compressed = await Promise.all(Array.from(files).map((f) => compressImageToDataUri(f)));
    setNewImages((prev) => [...prev, ...compressed]);
  }

  async function addSection() {
    const title = newTitle.trim();
    if (!title) { setMsg('Bölüm başlığı gerekli'); return; }
    setBusy(true); setMsg(null);
    const created = await createCustomTabSection(tabId, title, newBody.trim(), newImages);
    setBusy(false);
    if (!created) { setMsg('Eklenemedi'); return; }
    setNewTitle(''); setNewBody(''); setNewImages([]);
    await refresh();
    setMsg('Bölüm eklendi ✓');
  }

  async function removeSection(sectionId: number) {
    const ok = await deleteCustomTabSection(sectionId);
    if (!ok) { setMsg('Silinemedi'); return; }
    await refresh();
  }

  if (loading) return <p className="n-muted">Yükleniyor...</p>;
  if (!tab) return <p className="text-rose-400">Sekme bulunamadı.</p>;

  return (
    <div className="max-w-3xl">
      <button onClick={() => router.back()} className="text-sm text-cyan-400 hover:text-cyan-300 mb-4">← Geri</button>
      <h1 className="text-2xl font-bold mb-4 n-text"><span>{tab.emoji}</span> <span>{tab.label}</span></h1>
      {msg && <p className="text-sm n-muted mb-3">{msg}</p>}

      {tab.sections.length === 0 ? (
        <p className="n-muted mb-6">Bu sekmede henüz bölüm yok. Aşağıdan ekle.</p>
      ) : (
        <div className="grid gap-3 mb-8">
          {tab.sections.map((s) => (
            <div key={s.id} className="neon-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold n-text">{s.title}</p>
                  <p className="text-xs n-muted truncate">{s.body}</p>
                </div>
                <button onClick={() => removeSection(s.id)}
                  aria-label={`${s.title} bölümünü sil`}
                  className="px-2 py-1 rounded-md text-rose-400 hover:bg-rose-500/10 text-xs">Sil</button>
              </div>
              {s.images.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {s.images.map((uri, i) => (
                    <img key={i} src={uri} alt={`${s.title} görseli ${i + 1}`}
                      style={{ maxWidth: 80, maxHeight: 60, objectFit: 'contain' }} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="neon-card neon-cyan p-5 mb-4">
        <h2 className="font-bold mb-3 n-text">Bölüm ekle</h2>
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Bölüm başlığı" className="neon-input mb-2" />
        <textarea value={newBody} onChange={(e) => setNewBody(e.target.value)}
          placeholder="Yazı" rows={4} className="neon-input mb-3" />
        <input type="file" accept="image/*" multiple className="hidden" id="section-image-input"
          onChange={(e) => onImageFiles(e.target.files)} />
        <label htmlFor="section-image-input"
          className="inline-block px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10 cursor-pointer mb-3">
          Bilgisayardan Seç
        </label>
        {newImages.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {newImages.map((uri, i) => (
              <img key={i} src={uri} alt={`Yeni görsel ${i + 1}`}
                style={{ maxWidth: 80, maxHeight: 60, objectFit: 'contain' }} />
            ))}
          </div>
        )}
        <button onClick={addSection} disabled={busy || !newTitle.trim()}
          className="px-4 py-2 rounded-lg bg-cyan-400/15 text-cyan-200 border border-cyan-400/50 hover:bg-cyan-400/25 disabled:opacity-50 text-sm transition-colors">
          Bölüm ekle
        </button>
      </div>
    </div>
  );
}
