import type { OpeningCategory } from '@/lib/play/openingCategories';
import { categoryTitle } from '@/lib/play/openingCategories';

/** Bot dalindaki uc acilir kartin anahtarlari. */
export type BotStepKey = 'type' | 'opening' | 'criteria';

/** Bir acilis adi gercekten secilmis mi? Bos/bosluklu ad secim sayilmaz. */
function picked(openingName: string | null): string | null {
  const t = openingName?.trim();
  return t ? t : null;
}

/** 2. kart (Acilis Konumunu Sec) acilabilir mi? Tur secilmeden acilmaz. */
export function isOpeningUnlocked(category: OpeningCategory | null): boolean {
  return category !== null;
}

/** 3. kart (Mac Kriterlerini Sec) acilabilir mi? Kilit kurali TEK yerde. */
export function isCriteriaUnlocked(openingName: string | null): boolean {
  return picked(openingName) !== null;
}

/** 1. kartin basliginda gorunecek ozet; tur secilmediyse null. */
export function categorySummary(category: OpeningCategory | null): string | null {
  return category === null ? null : `✓ ${categoryTitle(category)}`;
}

/** 2. kartin basliginda gorunecek ozet; acilis secilmediyse null. */
export function openingSummary(openingName: string | null): string | null {
  const name = picked(openingName);
  return name === null ? null : `✓ ${name}`;
}
