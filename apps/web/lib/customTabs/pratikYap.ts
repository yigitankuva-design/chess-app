/**
 * "Pratik Yap" sekmesinin SABİT yapısı — admin ve sporcu ekranları bu tek
 * kaynaktan okur (liste iki yerde ayrı ayrı yazılmaz).
 */

export const PRATIK_YAP_LABEL = 'Pratik Yap';

/**
 * Madde 2026-09-02: Zafer'in isteğiyle artık DİĞER İKİ SABİT ALT SEKMEYLE
 * (Kazanç/Oyunsonu) AYNI şekilde gerçek bir CustomTabSection kaydı — sırası
 * (order_index) diğerleriyle birlikte serbestçe değiştirilebilir. İçeriği
 * hâlâ özel: sporcu tarafında bu satır açılınca normal yazı/görsel/konum
 * havuzu yerine OpeningPractice (açılış seç → kriter → maç) gösterilir;
 * admin tarafında içeriği (açılış/tür/varyant listesi) ayrı bir panelden
 * (OpeningCategoryCards) yönetilir — bu kayıt sadece SIRASINI tutar.
 */
export const OPENING_ROW = { title: 'Açılış Pratiği Yap', emoji: '📖' };

/** Konumları 5 kategoriye ayrılan alt sekmenin adı. */
export const OYUNSONU_SECTION = 'Oyunsonu Pratiği Yap';

/** Konum ekleme akışında "Konumun Sahibi" alanı yalnızca bu alt sekmede vardır. */
export const KAZANC_SECTION = 'Kazanç Konumunu Pratik Yap';

/** Her zaman var olması gereken alt sekmeler (yoksa otomatik oluşturulur). Sıra
 *  burada değil, gerçek order_index'te tutulur — bkz. sortPratikSections. */
export const FIXED_SECTIONS: { title: string; emoji: string }[] = [
  OPENING_ROW,
  { title: KAZANC_SECTION, emoji: '🏆' },
  { title: OYUNSONU_SECTION, emoji: '🏁' },
];

/**
 * "Oyunsonu Pratiği Yap" alt sekmesindeki 5 kategori. Konumlar bu başlıklara
 * ayrılarak eklenir; kategori YALNIZCA hoca'nın düzeni içindir — sporcuya
 * konumlar karışık gelir (kullanıcı kararı 2026-08-09).
 */
export const OYUNSONU_CATEGORIES = [
  'Piyon Finalleri',
  'Kale Finalleri',
  'Hafif Taşlar Arası Mücadele',
  'Ağır Taşlar Arası Mücadele',
  'Ağır Taşlar ile Hafif Taşlar Arası Mücadele',
] as const;

/** Kategorisi olmayan (eski) konumların toplandığı grup başlığı. */
export const KATEGORISIZ = 'Kategorisiz';

interface CategorizedPosition {
  category?: string | null;
}

/**
 * Konumları kategori başlıklarına göre gruplar. Her kategori için ANAHTAR HER
 * ZAMAN vardır (boşsa boş dizi) — ekran "0 konum" yazabilsin diye. Kategorisi
 * olmayan veya tanınmayan bir kategori taşıyan konumlar `KATEGORISIZ`e düşer.
 */
export function groupByCategory<T extends CategorizedPosition>(
  positions: T[],
): Record<string, T[]> {
  const out: Record<string, T[]> = { [KATEGORISIZ]: [] };
  for (const c of OYUNSONU_CATEGORIES) out[c] = [];
  for (const p of positions) {
    const key = p.category && out[p.category] ? p.category : KATEGORISIZ;
    out[key].push(p);
  }
  return out;
}

/** Sabit alt sekmeler adı değiştirilemez / silinemez. */
export function isFixedSection(title: string): boolean {
  return FIXED_SECTIONS.some((s) => s.title === title);
}

/** Sabit alt sekmenin ikonu; hoca'nın kendi sekmesiyse null. */
export function sectionEmoji(title: string): string | null {
  return FIXED_SECTIONS.find((s) => s.title === title)?.emoji ?? null;
}

/**
 * Görüntüleme sırası: önce sabitler (KENDİ ARALARINDA gerçek order_index'e
 * göre — admin'in Yukarı/Aşağı ile değiştirdiği sıra budur, madde
 * 2026-09-02), sonra hoca'nın kendi sekmeleri (kendi aralarındaki sıraları
 * korunur, listeye geldikleri sırayla).
 */
export function sortPratikSections<T extends { title: string; order_index: number }>(sections: T[]): T[] {
  const fixed = sections
    .filter((s) => isFixedSection(s.title))
    .sort((a, b) => a.order_index - b.order_index);
  const rest = sections.filter((s) => !isFixedSection(s.title));
  return [...fixed, ...rest];
}
