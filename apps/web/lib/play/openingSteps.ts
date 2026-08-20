/** Dış adımların anahtarları (madde: 2026-08-20, güncelleme — Tür/İsim/Varyant
 *  artık TEK bir iç içe akordiyonda (bkz. OpeningPicker), ayrı numaralı
 *  adımlar değil). */
export type BotStepKey = 'opening' | 'criteria';

/** Bir ad/varyant gercekten secilmis mi? Bos/bosluklu deger secim sayilmaz. */
function picked(value: string | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/** 2. kart (Mac Kriterlerini Sec) acilabilir mi? Kilit kurali TEK yerde. */
export function isCriteriaUnlocked(variantName: string | null): boolean {
  return picked(variantName) !== null;
}

/** 1. kartin basliginda gorunecek ozet; varyant secilmediyse null. */
export function variantSummary(variantName: string | null): string | null {
  const name = picked(variantName);
  return name === null ? null : `✓ ${name}`;
}
