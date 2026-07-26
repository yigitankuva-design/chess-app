/** Bot dalindaki iki acilir kartin anahtarlari. */
export type BotStepKey = 'opening' | 'criteria';

/** Bir acilis adi gercekten secilmis mi? Bos/bosluklu ad secim sayilmaz. */
function picked(openingName: string | null): string | null {
  const t = openingName?.trim();
  return t ? t : null;
}

/** 2. kart (Mac Kriterlerini Sec) acilabilir mi? Kilit kurali TEK yerde. */
export function isCriteriaUnlocked(openingName: string | null): boolean {
  return picked(openingName) !== null;
}

/** 1. kartin basliginda gorunecek ozet; acilis secilmediyse null. */
export function openingSummary(openingName: string | null): string | null {
  const name = picked(openingName);
  return name === null ? null : `✓ ${name}`;
}
