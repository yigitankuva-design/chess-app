import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

/** jsdom'un sessionStorage'ı test dosyaları arasında SIFIRLANMAZ — bir
 *  testin bıraktığı kayıt (örn. Hızlı Erişim açılım durumu) sıradaki testi
 *  sessizce bozabilir. Her testten sonra temizlenir. */
afterEach(() => {
  try { sessionStorage.clear(); } catch { /* jsdom yoksa (node ortamı) yok say */ }
});
