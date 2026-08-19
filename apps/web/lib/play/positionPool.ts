import { Chess } from 'chess.js';

export interface PoolPosition {
  id: string;
  fen: string;
  /** Oyunsonu kategorisi (varsa) — seçimi etkilemez, sadece taşınır. */
  category?: string | null;
  /** Hoca'nın verdiği kalıcı numara ("001"). Eski konumlarda yok. */
  code?: string;
}

/**
 * Konumun FEN'inden hamle sırasını okur (madde 2, 2026-08-19): Kazanç
 * Konumu/Oyunsonu pratiğinde sporcu HER ZAMAN hamle sırası kendisindeymiş
 * gibi devam eder — hoca konumu admin'de kaydederken sırayı zaten
 * belirliyor (PositionPoolFields.tsx), burada sadece OKUNUR. skipValidation:
 * bu konumlar bilerek şahsız olabilir (ŞAHSIZ POZİSYON DESTEĞİ).
 */
export function turnFromFen(fen: string): 'w' | 'b' {
  try {
    return new Chess(fen, { skipValidation: true }).turn();
  } catch {
    return 'w';
  }
}

/** Havuzdan tamamen rastgele bir öğe seçer. Havuz boş olamaz (çağıran kontrol eder).
 *  Yalnızca konum havuzları için değil, id'li herhangi bir liste için (örn. açılışlar). */
export function pickRandomPosition<T extends { id: string | number }>(pool: T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Havuzdan rastgele bir öğe seçer; `excludeId` verilmişse VE havuzda 2+ öğe
 *  varsa o öğeyi hariç tutar (art arda aynısı gelmesin — kullanıcı kararı). */
export function pickDifferentPosition<T extends { id: string | number }>(
  pool: T[], excludeId: string | number | null,
): T {
  if (excludeId === null || pool.length <= 1) return pickRandomPosition(pool);
  const candidates = pool.filter((p) => p.id !== excludeId);
  return pickRandomPosition(candidates);
}
