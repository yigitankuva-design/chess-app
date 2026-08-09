/** Belirli bir ihtimalle bot kasıtlı zayıf hamle yapsın mı? (0 = asla, 1 = her zaman) */
export function shouldBlunder(chance: number): boolean {
  return Math.random() < chance;
}

/**
 * Aday hamleler arasından (0. sıradaki en iyisi HARİÇ) rastgele birini seçer.
 * Tek aday varsa (alternatif bulunamadıysa) onu döner.
 */
export function pickBlunderMove(candidates: string[]): string {
  if (candidates.length <= 1) return candidates[0];
  const worse = candidates.slice(1);
  return worse[Math.floor(Math.random() * worse.length)];
}
