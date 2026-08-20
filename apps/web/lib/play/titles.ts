/**
 * "Sporcu Performans Puanı" ünvan kademeleri (madde: 2026-08-20) —
 * apps/api/chess_api/services/rating.py'deki TITLE_TIERS ile BİREBİR AYNI.
 * İki taraf ayrı dillerde olduğu için tek kaynaktan paylaşılamıyor;
 * değişirse İKİSİ DE güncellenmeli.
 */
const TITLE_TIERS: [number, number | null, string][] = [
  [0, 399, 'BD-1'], [400, 599, 'BD-2'], [600, 799, 'BD-3'], [800, 999, 'BD-4'],
  [1000, 1199, 'OD-1'], [1200, 1399, 'OD-2'], [1400, 1599, 'OD-3'],
  [1600, 1799, 'İD-1'], [1800, 1999, 'İD-2'],
  [2000, 2199, 'CM'], [2200, 2399, 'NM'], [2400, 2499, 'FM'],
  [2500, 2599, 'IM'], [2600, 2699, 'GM'], [2700, 2799, 'SGM'],
  [2800, null, 'WEGM'],
];

export function titleForRating(rating: number): string {
  const tier = TITLE_TIERS.find(([low, high]) => rating >= low && (high === null || rating <= high));
  return tier ? tier[2] : TITLE_TIERS[0][2];
}

/** "Ünvan - İsim (Puan)" — örn. "GM - Emir Dinç (2650)" (madde 7). Ünvan/puan
 *  bilinmiyorsa (tempo bağlamsız ekran) sade isim döner. */
export function formatPlayerLabel(name: string, rating?: number | null, title?: string | null): string {
  if (rating == null) return name;
  const t = title ?? titleForRating(rating);
  return `${t} - ${name} (${rating})`;
}
