import type { ColorChoice } from '@/lib/play/color';

/** Dış adımların anahtarları. Madde 2026-09-06 (üçüncü tur/4): "criteria"
 *  (Maç Kriterlerini Seç) ikiye ayrıldı — "color" (Renk Seç) ve "moveLimit"
 *  (İlerleme Sınırı Belirle). Tür/İsim/Varyant hâlâ TEK bir iç içe
 *  akordiyonda (bkz. OpeningPicker), ayrı numaralı adımlar değil. */
export type BotStepKey = 'opening' | 'color' | 'moveLimit';

/** Bir ad/varyant gercekten secilmis mi? Bos/bosluklu deger secim sayilmaz. */
function picked(value: string | null): string | null {
  const t = value?.trim();
  return t ? t : null;
}

/** 2. kart (Renk Seç) acilabilir mi? Kilit kurali TEK yerde. */
export function isColorUnlocked(variantName: string | null): boolean {
  return picked(variantName) !== null;
}

/** 3. kart (İlerleme Sınırı Belirle) acilabilir mi? */
export function isMoveLimitUnlocked(colorChoice: ColorChoice | null): boolean {
  return colorChoice !== null;
}

/** 1. kartin basliginda gorunecek ozet; varyant secilmediyse null. */
export function variantSummary(variantName: string | null): string | null {
  const name = picked(variantName);
  return name === null ? null : `✓ ${name}`;
}

const COLOR_LABELS: Record<ColorChoice, string> = { white: 'Beyaz', random: 'Rastgele', black: 'Siyah' };

/** 2. kartin basliginda gorunecek ozet; renk secilmediyse null. */
export function colorSummary(colorChoice: ColorChoice | null): string | null {
  return colorChoice === null ? null : `✓ ${COLOR_LABELS[colorChoice]}`;
}
