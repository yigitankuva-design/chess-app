import type { CSSProperties } from 'react';

/** Tıklanan/işaretlenen kareler için halka renkleri. */
export const RING_BLUE = 'rgba(37,99,235,0.85)';   // tıklandı, cevap sürüyor
export const RING_GREEN = 'rgba(22,163,74,0.9)';   // doğru
export const RING_RED = 'rgba(220,38,38,0.9)';     // yanlış

/**
 * Karenin ortasına içi boş bir halka çizer.
 *
 * Arka plan RENGİ kullanılmaz (kullanıcı kararı: "kare renklenmesin, çember
 * belirsin"). Halkanın içi saydam olduğu için karedeki taş görünmeye devam eder.
 *
 * NEDEN radial-gradient DEĞİL: gradient de halka çizerdi, ama test ortamı
 * (happy-dom) `radial-gradient` değerini tanımayıp DOM'a hiç yazmıyor —
 * ölçüldü — ve halka testlerle doğrulanamaz hale geliyordu. Yuvarlatılmış
 * kenarlık aynı görüntüyü verir ve standart CSS özellikleri olduğu için
 * hem tarayıcıda hem testte okunabilir.
 */
export function ringStyle(color: string): CSSProperties {
  return {
    borderRadius: '50%',
    border: `3px solid ${color}`,
    // Kenarlık karenin İÇİNDE kalsın, komşu kareleri itmesin.
    boxSizing: 'border-box',
  };
}
