export interface PoolPosition {
  id: string;
  fen: string;
}

/** Havuzdan tamamen rastgele bir konum seçer. Havuz boş olamaz (çağıran kontrol eder). */
export function pickRandomPosition(pool: PoolPosition[]): PoolPosition {
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Havuzdan rastgele bir konum seçer; `excludeId` verilmişse VE havuzda 2+ öğe
 *  varsa o öğeyi hariç tutar (art arda aynı konum gelmesin — kullanıcı kararı). */
export function pickDifferentPosition(pool: PoolPosition[], excludeId: string | null): PoolPosition {
  if (excludeId === null || pool.length <= 1) return pickRandomPosition(pool);
  const candidates = pool.filter((p) => p.id !== excludeId);
  return pickRandomPosition(candidates);
}
