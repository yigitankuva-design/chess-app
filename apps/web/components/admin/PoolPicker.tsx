'use client';
import { useState } from 'react';
import { POOL_CATEGORIES, fetchPoolImages } from '@/lib/admin/poolApi';
import type { PoolImage } from '@/lib/admin/poolApi';

interface Props {
  onSelect: (dataUri: string) => void;
  onClose: () => void;
}

/**
 * Kategoriye göre havuzdan görsel seçme paneli.
 *
 * Modal DEĞİL, satır-içi genişleyen panel — admin panelinde hiçbir yerde modal
 * kullanılmıyor (kontrol edildi), tutarlılık için aynı dil.
 */
export function PoolPicker({ onSelect, onClose }: Props) {
  const [category, setCategory] = useState<string | null>(null);
  const [images, setImages] = useState<PoolImage[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function pick(c: string) {
    setCategory(c);
    setLoading(true);
    setImages(null);
    const list = await fetchPoolImages(c);
    setImages(list);
    setLoading(false);
  }

  return (
    <div className="mt-2 p-3 rounded-lg border border-cyan-400/40 bg-cyan-400/[0.06] space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold n-muted uppercase tracking-widest flex-1">
          Havuzdan Seç
        </p>
        <button type="button" onClick={onClose}
          className="px-2.5 py-1 rounded-md text-xs bg-white/5 text-white/80 border border-white/15 hover:bg-white/10">
          Kapat
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {POOL_CATEGORIES.map((c) => (
          <button key={c} type="button" onClick={() => pick(c)}
            className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
              category === c
                ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
                : 'border-white/15 text-white/70 hover:bg-white/5'
            }`}>
            {c}
          </button>
        ))}
      </div>

      {category === null && (
        <p className="text-xs n-muted">Yukarıdan bir kategori seç.</p>
      )}
      {loading && <p className="text-xs n-muted">Yükleniyor...</p>}
      {!loading && images?.length === 0 && (
        <p className="text-xs n-muted">
          Bu kategoride henüz görsel yok. &ldquo;Bilgisayardan Seç&rdquo; ile ekleyip
          havuza kaydedebilirsin.
        </p>
      )}
      {!loading && images && images.length > 0 && (
        <div className="grid grid-cols-6 gap-2">
          {images.map((img) => (
            <img
              key={img.id}
              src={img.data_uri}
              alt={`${img.category} havuz görseli`}
              onClick={() => { onSelect(img.data_uri); onClose(); }}
              className="cursor-pointer rounded-md bg-white/5 border border-white/10 hover:border-cyan-400 transition-colors"
              style={{ width: 56, height: 56, objectFit: 'contain' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
