'use client';
import { useState } from 'react';
import { POOL_CATEGORIES, fetchPoolImages } from '@/lib/admin/poolApi';
import type { PoolImage } from '@/lib/admin/poolApi';

interface Props {
  onClose: () => void;
  /** Tek seçim modu (varsayılan) — tıklayınca hemen seçer ve paneli kapatır. */
  onSelect?: (dataUri: string) => void;
  /** Çoklu seçim modu — verilirse panel çoklu-seçim UI'ına geçer: tıklama
   *  seçimi aç/kapa yapar, kategori değiştirince seçimler SİLİNMEZ, "Seçilenleri
   *  Ekle" butonuyla toplu onaylanır. */
  onSelectMultiple?: (dataUris: string[]) => void;
}

/**
 * Kategoriye göre havuzdan görsel seçme paneli.
 *
 * Modal DEĞİL, satır-içi genişleyen panel — admin panelinde hiçbir yerde modal
 * kullanılmıyor (kontrol edildi), tutarlılık için aynı dil.
 */
export function PoolPicker({ onClose, onSelect, onSelectMultiple }: Props) {
  const [category, setCategory] = useState<string | null>(null);
  const [images, setImages] = useState<PoolImage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [basket, setBasket] = useState<string[]>([]);
  const multi = !!onSelectMultiple;

  async function pick(c: string) {
    setCategory(c);
    setLoading(true);
    setImages(null);
    const list = await fetchPoolImages(c);
    setImages(list);
    setLoading(false);
  }

  function toggle(uri: string) {
    setBasket((prev) => (prev.includes(uri) ? prev.filter((u) => u !== uri) : [...prev, uri]));
  }

  function confirmMulti() {
    if (basket.length === 0) return;
    onSelectMultiple?.(basket);
    onClose();
  }

  return (
    <div className="mt-2 p-3 rounded-lg border border-cyan-400/40 bg-cyan-400/[0.06] space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-xs font-bold n-muted uppercase tracking-widest flex-1">
          Havuzdan Seç{multi && basket.length > 0 ? ` (${basket.length} seçili)` : ''}
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
          {images.map((img) => {
            const on = basket.includes(img.data_uri);
            const label = `${img.category} havuz görseli${on ? ' (seçili)' : ''}`;
            if (!multi) {
              return (
                <img
                  key={img.id}
                  src={img.data_uri}
                  alt={label}
                  onClick={() => { onSelect?.(img.data_uri); onClose(); }}
                  className="cursor-pointer rounded-md bg-white/5 border border-white/10 hover:border-cyan-400 transition-colors"
                  style={{ width: 56, height: 56, objectFit: 'contain' }}
                />
              );
            }
            return (
              <button
                key={img.id}
                type="button"
                aria-label={label}
                onClick={() => toggle(img.data_uri)}
                className="relative rounded-md bg-white/5 transition-colors p-0"
                style={{
                  width: 56, height: 56,
                  border: on ? '2px solid #22d3ee' : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <img src={img.data_uri} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                {on && (
                  <span aria-hidden="true" className="absolute top-0.5 right-0.5 text-cyan-300 text-xs font-bold"
                    style={{ background: 'rgba(0,0,0,0.6)', borderRadius: 4, padding: '0 3px' }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {multi && basket.length > 0 && (
        <button type="button" onClick={confirmMulti}
          className="w-full px-3 py-2 rounded-lg text-sm font-semibold bg-green-400/15 text-green-200 border border-green-400/50 hover:bg-green-400/25">
          Seçilenleri Ekle ({basket.length})
        </button>
      )}
    </div>
  );
}
