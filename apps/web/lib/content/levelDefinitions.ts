/**
 * Madde 2026-09-05 (1), güncelleme 2026-09-08 (görsel): 4 sabit düzeyin
 * (Temel/Başlangıç/Orta/İleri Düzey) tanımları — Zafer hocanın verdiği
 * metinler. Modül adına TAM eşleşme ile kullanılır (admin/content
 * sayfasındaki "Önerilen açıklamayı kullan" butonu); eşleşme yoksa buton
 * gösterilmez — hiçbir şey uydurulmaz/varsayılmaz. Temel Düzey/Başlangıç
 * Düzeyi metinleri Zafer'in gönderdiği görseldeki TAM metinle güncellendi
 * (2026-09-08) — Orta/İleri Düzey için henüz yeni metin verilmedi, eski
 * metin duruyor.
 */
export const DEFAULT_LEVEL_DESCRIPTIONS: Record<string, string> = {
  'Temel Düzey': 'Anasınıfı Düzeyi, Temel Kuralları Öğrenme Evresinde / Puan Aralığı:0 – 399',
  'Başlangıç Düzeyi': 'Temel Kuralları Bilir, Taktiksel Gelişim Evresinde / Puan Aralığı:400 – 999',
  'Orta Düzey':
    'ELO puan aralığı 1000-1599 arasıdır ve taktiksel olarak daha iyidir, '
    + 'stratejik düşünmesi daha iyidir, konumsal oyun oynamaya adım atmıştır. '
    + 'Turnuvalara katılım sergilemektedir.',
  'İleri Düzey':
    'ELO puan aralığı 1600-2199 arasıdır ve güçlü temel ve tutarlı performansa '
    + 'sahiptir, hesaplama ve planlama gücü gelişmiş, üst düzey turnuvalara '
    + 'katılmaktadır.',
};

/** Modül adı 4 bilinen düzeyden biriyle TAM eşleşirse önerilen metni döner;
 *  eşleşmezse null (buton gösterilmez, hiçbir şey uydurulmaz). */
export function suggestedLevelDescription(moduleName: string): string | null {
  return DEFAULT_LEVEL_DESCRIPTIONS[moduleName.trim()] ?? null;
}

/**
 * Madde 2026-09-07 (2), güncelleme 2026-09-08 (görsel): başlığın 3. satırı —
 * düzeyde işlenen konuların kısa özeti. Zafer'in verdiği örnekler Temel
 * Düzey ve Başlangıç Düzeyi için — Orta/İleri Düzey için henüz metin
 * verilmedi, o yüzden burada YOK (hiçbir şey uydurulmaz, KURAL #1).
 */
export const DEFAULT_LEVEL_TOPICS: Record<string, string> = {
  'Temel Düzey': 'Satranç Tahtası, Taşlar ve Temel Kurallar',
  'Başlangıç Düzeyi': 'Temel taktikler ve oyun prensipleri',
};

/** Modül adı bilinen bir düzeyle TAM eşleşirse önerilen konu özetini döner;
 *  eşleşmezse null (buton gösterilmez, hiçbir şey uydurulmaz). */
export function suggestedLevelTopics(moduleName: string): string | null {
  return DEFAULT_LEVEL_TOPICS[moduleName.trim()] ?? null;
}
