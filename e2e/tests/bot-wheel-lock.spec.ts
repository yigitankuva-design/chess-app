import { test, expect } from '@playwright/test';

/** ÖZ-DENETİM: bota karşı oynarken tahtanın üstünde fare tekerleği çevrilince
 *  tahta eski hamleye kilitleniyor mu? Kullanıcı "hamle ilerleyince taşlar
 *  kullanım dışı oluyor" diyor. Bu test o senaryoyu GERÇEK tarayıcıda dener. */
test('tekerlek tahtayı geçmişe kilitliyor mu (gerçek tahta)', async ({ page }) => {
  // Giriş ekranını atlamak için sahte jeton (bot oyunu çevrimdışı çalışır).
  await page.addInitScript(() => {
    sessionStorage.setItem('chess_app_token', 'e2e-dummy');
    sessionStorage.setItem('bea_athlete_name', 'Test');
  });

  await page.goto('/play?skill=0&tc=5%2B0');

  // Tahta gerçekten çizildi mi?
  const e2 = page.locator('[data-square="e2"]');
  await expect(e2).toBeVisible({ timeout: 20000 });

  // Sporcu bir hamle yapar: e2 -> e4 (tıkla-tıkla).
  await e2.click();
  await page.locator('[data-square="e4"]').click();
  await page.waitForTimeout(1500);

  // Şu an "Canlıya dön" OLMAMALI (henüz geçmişe bakmadık).
  const backBtnBefore = await page.getByRole('button', { name: 'Canlıya dön' })
    .isVisible().catch(() => false);

  // Tahtanın üstünde fareyi çevir (kullanıcının yanlışlıkla yapabileceği şey).
  const board = page.locator('[data-bsa-board]');
  await board.dispatchEvent('wheel', { deltaY: -150 });
  await page.waitForTimeout(500);

  // Tahta geçmişe kilitlendi mi? "Canlıya dön" çıktıysa EVET.
  const lockedAfterWheel = await page.getByRole('button', { name: 'Canlıya dön' })
    .isVisible().catch(() => false);

  // DÜZELTME: tahtaya bir kez dokun → oyuna geri dönmeli (banner kaybolur).
  await board.click({ position: { x: 30, y: 30 } });
  await page.waitForTimeout(500);
  const stillLocked = await page.getByRole('button', { name: 'Canlıya dön' })
    .isVisible().catch(() => false);

  console.log('SONUC_wheel_oncesi_banner:', backBtnBefore);
  console.log('SONUC_wheel_sonrasi_kilit:', lockedAfterWheel);
  console.log('SONUC_dokunma_sonrasi_hala_kilit:', stillLocked);

  expect(backBtnBefore).toBe(false);       // başta canlı
  expect(lockedAfterWheel).toBe(true);     // tekerlek kilitledi (hata mevcuttu)
  expect(stillLocked).toBe(false);         // tek dokunuş kurtardı (düzeltme çalışıyor)
});
