import type { OpeningCategory } from '@/lib/play/openingCategories';
import { categoryTitle } from '@/lib/play/openingCategories';

/** Bot dalindaki DORT acilir kartin anahtarlari (madde: 2026-08-20 —
 *  "opening" (acilis ISMI) ile "variant" ARASINA yeni bir kart girdi). */
export type BotStepKey = 'type' | 'opening' | 'variant' | 'criteria';

/** Bir ad/varyant gercekten secilmis mi? Bos/bosluklu deger secim sayilmaz. */
function picked(value: string | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/** 2. kart (Acilis Ismini Sec) acilabilir mi? Tur secilmeden acilmaz. */
export function isOpeningUnlocked(category: OpeningCategory | null): boolean {
  return category !== null;
}

/** 3. kart (Varyant Sec) acilabilir mi? Acilis ismi secilmeden acilmaz. */
export function isVariantUnlocked(openingName: string | null): boolean {
  return picked(openingName) !== null;
}

/** 4. kart (Mac Kriterlerini Sec) acilabilir mi? Kilit kurali TEK yerde. */
export function isCriteriaUnlocked(variantName: string | null): boolean {
  return picked(variantName) !== null;
}

/** 1. kartin basliginda gorunecek ozet; tur secilmediyse null. */
export function categorySummary(category: OpeningCategory | null): string | null {
  return category === null ? null : `✓ ${categoryTitle(category)}`;
}

/** 2. kartin basliginda gorunecek ozet; acilis ismi secilmediyse null. */
export function openingSummary(openingName: string | null): string | null {
  const name = picked(openingName);
  return name === null ? null : `✓ ${name}`;
}

/** 3. kartin basliginda gorunecek ozet; varyant secilmediyse null. */
export function variantSummary(variantName: string | null): string | null {
  const name = picked(variantName);
  return name === null ? null : `✓ ${name}`;
}
