/**
 * Madde 2026-08-25: Alt Konu sayfasından "Geri" ile Ana Menü'ye dönünce
 * Antrenör/Dersler/Düzey/Konu zinciri AÇIK gelsin diye — antrenör gereksiz
 * tıklamalardan kurtulup direkt başka bir Alt Konu'ya geçebilsin.
 *
 * NestedSectionAccordion'ın kendi iç akordiyon durumu (openId, her seviyede
 * ayrı bileşen örneği) sayfa geçişinde KAYBOLUR — Ana Menü'nün kendi
 * sessionStorage'ı (bea_qa_state_v3) sadece EN ÜST seviyeyi (openTab) bilir,
 * özel sekmenin İÇİNDEKİ iç içe yapıyı bilmez. Bu yüzden ayrı, tek seferlik
 * (yazılıp hemen okunup silinen) bir anahtar kullanılır.
 */
const PENDING_PATH_KEY = 'bea_qa_custom_path_v1';

interface PendingOpenPath {
  tabId: number;
  /** Kökten (en üstteki bölüm) başlayarak, AÇIK bırakılacak her seviyenin
   *  bölüm id'si — Alt Konu'nun KENDİSİ dahil DEĞİLDİR (o zaten navigasyonla
   *  ayrı sayfaya gider, akordiyon içinde açılmaz). */
  path: number[];
}

/** Alt Konu sayfasının "Geri" butonu çağırır — bir sonraki Ana Menü
 *  mount'unda bir kere okunup silinsin diye sessionStorage'a yazar. */
export function writePendingOpenPath(value: PendingOpenPath): void {
  try {
    sessionStorage.setItem(PENDING_PATH_KEY, JSON.stringify(value));
  } catch { /* ignore */ }
}

/** CustomTabPanel mount olunca çağırır — kayıtlı yol BU sekmeye (tabId) aitse
 *  döner ve anahtarı SİLER (tek seferlik; sonraki normal tıklamalar etkilenmez). */
export function readAndClearPendingOpenPath(tabId: number): number[] | undefined {
  try {
    const raw = sessionStorage.getItem(PENDING_PATH_KEY);
    if (!raw) return undefined;
    sessionStorage.removeItem(PENDING_PATH_KEY);
    const parsed = JSON.parse(raw) as PendingOpenPath;
    return parsed.tabId === tabId ? parsed.path : undefined;
  } catch {
    return undefined;
  }
}
