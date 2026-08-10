/**
 * "Pratik Yap" sekmesinin SABİT yapısı — admin ve sporcu ekranları bu tek
 * kaynaktan okur (liste iki yerde ayrı ayrı yazılmaz).
 */

export const PRATIK_YAP_LABEL = 'Pratik Yap';

/** Alt sekme DEĞİL — açılış listesi sayfasına giden sabit bağlantı satırı. */
export const OPENING_ROW = { title: 'Açılış Pratiği Yap', emoji: '📖' };

/** Her zaman var olması gereken alt sekmeler (yoksa otomatik oluşturulur). */
export const FIXED_SECTIONS: { title: string; emoji: string }[] = [
  { title: 'Kazanç Konumunu Pratik Yap', emoji: '🏆' },
  { title: 'Oyunsonu Pratiği Yap', emoji: '🏁' },
];

/** Sabit alt sekmeler adı değiştirilemez / silinemez. */
export function isFixedSection(title: string): boolean {
  return FIXED_SECTIONS.some((s) => s.title === title);
}

/** Sabit alt sekmenin ikonu; hoca'nın kendi sekmesiyse null. */
export function sectionEmoji(title: string): string | null {
  return FIXED_SECTIONS.find((s) => s.title === title)?.emoji ?? null;
}

/**
 * Görüntüleme sırası: önce sabitler (tanımlı sırayla), sonra hoca'nın kendi
 * sekmeleri (kendi aralarındaki sıraları korunur). Kayıtlı veriye dokunmaz.
 */
export function sortPratikSections<T extends { title: string }>(sections: T[]): T[] {
  const fixed: T[] = [];
  for (const f of FIXED_SECTIONS) {
    const found = sections.find((s) => s.title === f.title);
    if (found) fixed.push(found);
  }
  const rest = sections.filter((s) => !isFixedSection(s.title));
  return [...fixed, ...rest];
}
