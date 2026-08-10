import { test, expect } from '@playwright/test';

/** ÖZ-DENETİM: her sporcu sayfasını GERÇEK tarayıcıda açar, sayfa çöküyor mu
 *  (beyaz ekran / JavaScript hatası) diye bakar. İçerik sunucudan gelmese bile
 *  sayfanın ÇÖKMEMESİ gerekir — çöküyorsa gerçek bir hata var. */
const SAYFALAR = [
  '/home', '/play', '/pratik/suresiz', '/puzzle', '/daily',
  '/srs', '/analiz', '/eglence', '/badges', '/profile',
];

for (const yol of SAYFALAR) {
  test(`sayfa cokmuyor: ${yol}`, async ({ page }) => {
    const hatalar: string[] = [];
    page.on('pageerror', (e) => hatalar.push(String(e.message)));

    await page.addInitScript(() => {
      sessionStorage.setItem('chess_app_token', 'e2e-dummy');
      sessionStorage.setItem('bea_athlete_name', 'Test');
    });

    await page.goto(yol, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // React hata sınırı ekranı çıktı mı?
    const govde = await page.locator('body').innerText().catch(() => '');
    const cokmusEkran = /Application error|Something went wrong|bir şeyler ters/i.test(govde);
    const bosEkran = govde.trim().length < 5;

    console.log(`TARAMA ${yol} | jsHata:${hatalar.length} | cokme:${cokmusEkran} | bos:${bosEkran} | ilk120:${govde.slice(0, 120).replace(/\n+/g, ' ')}`);

    expect(cokmusEkran, `${yol} çöktü: ${govde.slice(0, 200)}`).toBe(false);
    expect(bosEkran, `${yol} boş ekran`).toBe(false);
    expect(hatalar.join(' | '), `${yol} JS hatası`).toBe('');
  });
}
