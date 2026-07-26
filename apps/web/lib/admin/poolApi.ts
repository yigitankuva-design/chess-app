import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Görsel havuzu kategorileri — backend'deki `chess_api/pool_categories.py`
 * listesinin AYNISI ve AYNI SIRADA olmalı. İki dilde iki kopya olmasının
 * sebebi: backend doğrulama yapar, ön yüz seçim listesi gösterir; ortak bir
 * uç ekleyip her açılışta ağ isteği yapmak bu 12 sabit için gereksiz.
 * Biri değişirse ikisi birlikte değişmeli (test bunu kilitliyor).
 */
export const POOL_CATEGORIES = [
  'Geometrik Şekiller',
  'Satranç Tahtası',
  'Satranç Taşları',
  'Hayvanlar',
  'Bitkiler',
  'Taşıtlar',
  'Gezegenler',
  'Meslekler',
  'Gök Cisimleri',
  'Satranç Şampiyonları',
  'Harfler',
  'Rakamlar',
] as const;

export type PoolCategory = (typeof POOL_CATEGORIES)[number];

export interface PoolImage {
  id: number;
  category: string;
  data_uri: string;
}

/** Bir kategorinin görsellerini getirir. Hata durumunda boş liste döner. */
export async function fetchPoolImages(category: string): Promise<PoolImage[]> {
  try {
    const r = await fetch(`${API_BASE}/pool-images?category=${encodeURIComponent(category)}`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** Görseli havuza ekler. Başarılıysa (veya zaten varsa) true döner. */
export async function addPoolImage(category: string, dataUri: string): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/admin/pool-images`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ category, data_uri: dataUri }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * Görseli havuzdan siler. Başarılıysa true döner.
 *
 * Bu işlem mevcut soruları bozmaz — soru kaydedilirken görselin data-URI'si
 * sorunun içine kopyalanır, havuza referans tutulmaz.
 */
export async function deletePoolImage(id: number): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/admin/pool-images/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}
