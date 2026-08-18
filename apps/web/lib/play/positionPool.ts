export interface PoolPosition {
  id: string;
  fen: string;
  /** Oyunsonu kategorisi (varsa) — seçimi etkilemez, sadece taşınır. */
  category?: string | null;
  /** Hoca'nın verdiği kalıcı numara ("001"). Eski konumlarda yok. */
  code?: string;
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
