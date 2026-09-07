'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type BackHandler = () => void;

interface Ctx {
  handler: BackHandler | null;
  setHandler: (fn: BackHandler | null) => void;
}

const BackOverrideContext = createContext<Ctx | null>(null);

/**
 * Madde 2026-09-04 (4): uygulamada TEK bir geri butonu var (AppNav.tsx'in
 * üst bar'ı) — ama bazı sayfaların "geri" işlemi düz bir sayfa değişikliği
 * değil, ÖZEL bir mantık gerektiriyor (örn. custom/[id]/alt-konu/[sectionId]
 * sayfasının accordion'da hangi yolun açık kaldığını sessionStorage'a
 * yazması). Bu sayfalar KENDİ butonlarını çizmek yerine `useBackOverride`
 * ile bu mantığı kaydeder; AppNav TEK butonuyla `useBackOverrideHandler`
 * üzerinden bunu okuyup çağırır — ekranda İKİNCİ bir geri göstergesi hiç
 * oluşmaz.
 */
export function BackOverrideProvider({ children }: { children: ReactNode }) {
  const [handler, setHandler] = useState<BackHandler | null>(null);
  // Madde 2026-09-07 (bug fix, bkz. useBackOverride'daki not): value objesi
  // ÖNCEDEN her render'da YENİDEN oluşturuluyordu — Provider'ın herhangi bir
  // NEDENLE (ör. üst bileşen re-render'ı) tekrar render olması bile TÜM
  // context tüketicilerine (AppNav dahil) "değer değişti" gibi görünüyordu.
  // useMemo ile value SADECE `handler` GERÇEKTEN değişince yeni referans alır.
  const value = useMemo(() => ({ handler, setHandler }), [handler]);
  return (
    <BackOverrideContext.Provider value={value}>
      {children}
    </BackOverrideContext.Provider>
  );
}

/** AppNav bunu okur — dolu ise varsayılan router.back()/push YERİNE bunu çağırır. */
export function useBackOverrideHandler(): BackHandler | null {
  const ctx = useContext(BackOverrideContext);
  return ctx?.handler ?? null;
}

/**
 * Bir sayfa özel "geri" mantığını kaydeder — unmount olunca otomatik
 * temizlenir, sıradaki sayfa AppNav'ın varsayılan davranışına döner.
 * `null` verilirse (ör. koşullu) override devre dışı kalır.
 *
 * Madde 2026-09-07 (bug fix — gerçek hata: "Geri"/"Ana Sayfa" butonları
 * Antrenör/Dersler/Alt Konu sayfasında tepki vermiyordu): İKİ ayrı
 * kararsız referans bir araya gelince sonsuz render döngüsü oluşuyordu:
 *   1) `fn` çoğu çağıran tarafta (ör. alt-konu/[sectionId]/page.tsx)
 *      `useCallback` İLE SARILMAMIŞ, HER render'da YENİ bir fonksiyon.
 *   2) `useContext(BackOverrideContext)`'in döndürdüğü `ctx` nesnesi de
 *      ÖNCEDEN Provider'da her render'da yeniden oluşturuluyordu (bkz.
 *      BackOverrideProvider'daki useMemo düzeltmesi).
 * `fn` VEYA `ctx` effect'in bağımlılık dizisindeyse: render → referans
 * değişir → effect yeniden çalışır → `setHandler(...)` state yazar →
 * Provider (ve context değeri) yeniden oluşur → BU sayfa (context
 * tüketicisi olduğu için) yeniden render olur → referanslar YİNE
 * değişir → ... SONSUZ DÖNGÜ ("Maximum update depth exceeded"). Çözüm
 * İKİ parça: (a) Provider'da value useMemo'lu (yalnızca `handler`
 * GERÇEKTEN değişince yeni referans), (b) burada effect SADECE React'in
 * KENDİSİ garanti ettiği DAİMA-SABİT `setHandler` fonksiyonuna ve
 * "bir handler var mı yok mu" (`hasHandler`) durumuna bağımlı — `fn`'in
 * KENDİSİ bir `ref`'te tutulup effect'i hiç tetiklemez.
 */
export function useBackOverride(fn: BackHandler | null): void {
  const ctx = useContext(BackOverrideContext);
  const setHandler = ctx?.setHandler; // React'in useState setter'ı — HER ZAMAN sabit referans.
  const fnRef = useRef(fn);
  fnRef.current = fn; // her render'da güncel tutulur — effect'i TETİKLEMEZ.

  const hasHandler = fn !== null;
  useEffect(() => {
    if (!setHandler) return;
    if (!hasHandler) { setHandler(null); return; }
    // Referansı SABİT bir sarmalayıcı — her zaman fnRef.current'ın O ANKİ
    // değerini çağırır, bu yüzden effect'i yeniden tetiklemeden güncel kalır.
    const stableHandler = () => fnRef.current?.();
    setHandler(() => stableHandler);
    return () => setHandler(null);
  }, [setHandler, hasHandler]);
}
