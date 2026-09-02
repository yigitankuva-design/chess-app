/**
 * "Pratik Yap" sekmesinin SABİT yapısı — admin ve sporcu ekranları bu tek
 * kaynaktan okur (liste iki yerde ayrı ayrı yazılmaz).
 */

export const PRATIK_YAP_LABEL = 'Pratik Yap';

/**
 * Madde 2026-09-02 (1): Zafer'in isteğiyle 3 sabit alt sekme (Açılış/
 * Kazanç/Oyunsonu) diğer CustomTabSection kayıtlarıyla AYNI şekilde gerçek
 * bir kayıt — order_index'i var, admin Yukarı/Aşağı ile serbestçe sıralar.
 * Madde 2026-09-02 (2): admin artık bunların BAŞLIĞINI da serbestçe
 * değiştirebiliyor ve silebiliyor. Bu yüzden özel davranışları (açılış
 * pratiği ekranı, 5 kategorili konum seçimi, "Konumun Sahibi" alanı) ARTIK
 * BAŞLIK METNİNE bakarak tanınMAZ — section_kind adında, oluşturulduktan
 * sonra hiç değişmeyen bir alana bakılır (bkz. CustomTabSection.section_kind,
 * backend migration CustomTabSectionKind). `title` alanı SADECE görüntülenen
 * isimdir; `kind` sabit kimliktir.
 */
interface FixedSectionDef { kind: string; title: string; emoji: string }

export const OPENING_KIND = 'opening';
export const KAZANC_KIND = 'kazanc';
export const OYUNSONU_KIND = 'oyunsonu';

/** Açılış Pratiği Yap açılınca sporcuya OpeningPractice (açılış seç →
 *  kriter → maç) gösterilir; admin tarafında içeriği (açılış/tür/varyant
 *  listesi) ayrı bir panelden (OpeningCategoryCards) yönetilir. */
export const OPENING_ROW: FixedSectionDef = { kind: OPENING_KIND, title: 'Açılış Pratiği Yap', emoji: '📖' };

/** Konum ekleme akışında "Konumun Sahibi" alanı yalnızca bu bölümde vardır. */
const KAZANC_ROW: FixedSectionDef = { kind: KAZANC_KIND, title: 'Kazanç Konumunu Pratik Yap', emoji: '🏆' };

/** Konumları 5 kategoriye ayrılan bölüm. */
const OYUNSONU_ROW: FixedSectionDef = { kind: OYUNSONU_KIND, title: 'Oyunsonu Pratiği Yap', emoji: '🏁' };

/** Her zaman var olması gereken alt sekmeler (yoksa otomatik oluşturulur,
 *  varlık kontrolü section_kind'e göre yapılır — bkz. admin/settings/tabs
 *  toggleCustomTab). Sıra burada değil, gerçek order_index'te tutulur. */
export const FIXED_SECTIONS: FixedSectionDef[] = [OPENING_ROW, KAZANC_ROW, OYUNSONU_ROW];

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

/** Bu section_kind bir sabit alt sekmeye mi ait? (title'a DEĞİL, kind'e bakar —
 *  admin başlığı değiştirse bile doğru sonucu verir.) */
export function isFixedSection(kind: string | null | undefined): boolean {
  return !!kind && FIXED_SECTIONS.some((s) => s.kind === kind);
}

/** Sabit alt sekmenin varsayılan ikonu; hoca'nın kendi sekmesiyse null. */
export function sectionEmoji(kind: string | null | undefined): string | null {
  return FIXED_SECTIONS.find((s) => s.kind === kind)?.emoji ?? null;
}

/**
 * Görüntüleme sırası: önce sabitler (KENDİ ARALARINDA gerçek order_index'e
 * göre — admin'in Yukarı/Aşağı ile değiştirdiği sıra budur), sonra hoca'nın
 * kendi sekmeleri (kendi aralarındaki sıraları korunur, listeye geldikleri
 * sırayla).
 */
export function sortPratikSections<T extends { section_kind?: string | null; order_index: number }>(
  sections: T[],
): T[] {
  const fixed = sections
    .filter((s) => isFixedSection(s.section_kind))
    .sort((a, b) => a.order_index - b.order_index);
  const rest = sections.filter((s) => !isFixedSection(s.section_kind));
  return [...fixed, ...rest];
}
