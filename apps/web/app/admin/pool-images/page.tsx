'use client';
import { useState } from 'react';
import { POOL_CATEGORIES, fetchPoolImages, deletePoolImage } from '@/lib/admin/poolApi';
import type { PoolImage } from '@/lib/admin/poolApi';

/**
 * Görsel havuzu yönetimi — kategorileri gez, yanlış/bozuk görseli sil.
 *
 * Silme SATIR-ICI onay ister (window.confirm degil): izgarada onlarca kucuk
 * kart var, hangisinin silinecegini metinle anlatmak zor; ayrica window.confirm
 * happy-dom'da test edilemez. Ayni anda yalnizca BIR onay acik olabilir.
 */
export default function AdminPoolImagesPage() {
  const [category, setCategory] = useState<string | null>(null);
  const [images, setImages] = useState<PoolImage[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function pick(c: string) {
    setCategory(c);
    setLoading(true);
    setImages(null);
    setConfirmingId(null);
    setMsg(null);
    const list = await fetchPoolImages(c);
    setImages(list);
    setLoading(false);
  }

  async function remove(id: number) {
    setMsg(null);
    const ok = await deletePoolImage(id);
    if (!ok) {
      setMsg('Görsel silinemedi');
      setConfirmingId(null);
      return;
    }
    // Listeyi yeniden çekmek yerine yerel state'ten çıkar — gereksiz ağ isteği yok.
    setImages((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
    setConfirmingId(null);
  }

  return (
    <div className="space-y-5">
      <h2 className="font-bold n-text text-lg">Görsel Havuzu</h2>
      <p className="text-xs n-muted">
        Soru eklerken &ldquo;Havuzdan Seç&rdquo; ile kullanılan görseller. Yanlış veya
        bozuk bir görseli buradan kaldırabilirsin. Bir görseli silmek, onu daha önce
        kullanan <b>soruları etkilemez</b> — o sorular görseli kendi içlerinde saklar.
      </p>

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

      {msg && <p className="text-rose-400 text-sm">{msg}</p>}

      {category === null && (
        <p className="text-xs n-muted">Yukarıdan bir kategori seç.</p>
      )}
      {loading && <p className="text-xs n-muted">Yükleniyor...</p>}
      {!loading && images?.length === 0 && (
        <p className="text-xs n-muted">Bu kategoride görsel yok.</p>
      )}

      {!loading && images && images.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {images.map((img) => (
            <div key={img.id} className="neon-card p-2 space-y-2 flex flex-col items-center">
              <img src={img.data_uri} alt={`${img.category} havuz görseli`}
                className="rounded-md bg-white/5"
                style={{ width: 96, height: 96, objectFit: 'contain' }} />
              {confirmingId === img.id ? (
                <div className="w-full space-y-1">
                  <p className="text-[0.7rem] text-center n-muted">Emin misin?</p>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => remove(img.id)}
                      className="flex-1 px-2 py-1 rounded-md text-[0.7rem] bg-rose-400/20 text-rose-200 border border-rose-400/50">
                      Evet, sil
                    </button>
                    <button type="button" onClick={() => setConfirmingId(null)}
                      className="flex-1 px-2 py-1 rounded-md text-[0.7rem] bg-white/5 text-white/80 border border-white/15">
                      Vazgeç
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmingId(img.id)}
                  className="w-full px-2 py-1 rounded-md text-[0.7rem] bg-rose-400/10 text-rose-300 border border-rose-400/40 hover:bg-rose-400/20">
                  Sil
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
