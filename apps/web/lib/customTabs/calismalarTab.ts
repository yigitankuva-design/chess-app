/**
 * Madde 2026-09-07 (Antrenör Paneli, 1): admin'in Sekmeler'de yönettiği,
 * antrenörün KENDİ panelinde (/coach) kullandığı özel sekme sporcunun
 * Hızlı Erişim'inde (/home) GÖSTERİLMEZ.
 *
 * Madde 2026-09-08 (devam): bu sekmeyi tanıma kontrolü ÖNCEDEN SADECE
 * BAŞLIĞIN tam olarak "Antrenör" olmasına bakıyordu (bkz. "Dersler" ve
 * "Pratik Yap" ile AYNI hata deseni). Zafer bu sekmeyi "Çalışmalar"
 * olarak yeniden adlandırınca kontrol SESSİZCE bozuldu — sekme sporcu
 * tarafında yeniden görünür oldu. Artık `kind==='antrenor_calismalar'`
 * KALICI işaretine bakılıyor (backend migration CustomTabKindC,
 * section_kind/Pratik Yap kind ile AYNI desen) — eski başlık kontrolü
 * YEDEK olarak kalıyor (migration'ı henüz almamış ortamlar/testler için).
 */
export const ANTRENOR_CALISMALAR_KIND = 'antrenor_calismalar';

/** Bu kontrolün YEDEK dalı — sekmenin ilk oluşturulduğu andaki
 *  varsayılan/orijinal başlık ("Çalışmalar" değil, "Antrenör"). */
export const ANTRENOR_CALISMALAR_LEGACY_LABEL = 'Antrenör';

export function isAntrenorCalismalarTab(tab: { kind?: string | null; label: string }): boolean {
  return tab.kind === ANTRENOR_CALISMALAR_KIND || tab.label === ANTRENOR_CALISMALAR_LEGACY_LABEL;
}
