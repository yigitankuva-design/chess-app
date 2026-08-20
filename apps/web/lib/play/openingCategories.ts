/** Açılış türleri — admin ve sporcu tarafı AYNI listeyi buradan okur. */

export type OpeningCategory = 'e4' | 'd4' | 'diger';

export const OPENING_CATEGORIES: {
  key: OpeningCategory; title: string; emoji: string;
}[] = [
  { key: 'e4', title: "e4'lü Açılışlar", emoji: '♙' },
  { key: 'd4', title: "d4'lü Açılışlar", emoji: '♟️' },
  { key: 'diger', title: 'Diğer Açılışlar', emoji: '♞' },
];

/** Bilinmeyen/boş değer "diger" sayılır — hiçbir açılış listeden düşmez. */
export function normalizeCategory(raw: string | null | undefined): OpeningCategory {
  return raw === 'e4' || raw === 'd4' ? raw : 'diger';
}

export function categoryTitle(key: OpeningCategory): string {
  return OPENING_CATEGORIES.find((c) => c.key === key)!.title;
}

/** Listeyi üç gruba ayırır. Üç anahtar HER ZAMAN vardır (boşsa boş dizi). */
export function groupOpenings<T extends { category?: string | null }>(
  list: T[],
): Record<OpeningCategory, T[]> {
  const out: Record<OpeningCategory, T[]> = { e4: [], d4: [], diger: [] };
  for (const item of list) out[normalizeCategory(item.category)].push(item);
  return out;
}
