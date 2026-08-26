/**
 * Madde 2026-09-05 (1): 4 sabit düzeyin (Temel/Başlangıç/Orta/İleri Düzey)
 * ELO bandı + yaş/özellik tanımları — Zafer hocanın verdiği metinler.
 * Modül adına TAM eşleşme ile kullanılır (admin/content sayfasındaki
 * "Önerilen açıklamayı kullan" butonu); eşleşme yoksa buton gösterilmez —
 * hiçbir şey uydurulmaz/varsayılmaz.
 */
export const DEFAULT_LEVEL_DESCRIPTIONS: Record<string, string> = {
  'Temel Düzey':
    'ELO puan aralığı 0-399 arasıdır ve satranca yeni başlamıştır. Temel kuralları '
    + 'bilmemektedir. Okul öncesi yaş grubunu (4-5-6 yaş) belirtir.',
  'Başlangıç Düzeyi':
    'ELO puan aralığı 400-999 arasıdır ve temel kuralları bilir, basit düzeyde '
    + 'taktiksel bilgisi vardır, düzenli maç yapmaya başlamıştır. Stratejik '
    + 'düşünmeye basit düzeyde başlamıştır.',
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
