/**
 * Madde 2026-09-07 (GRUP C): Sporcu Profili fotoğraf yükleme — cihazdan/
 * kameradan seçilen görsel, sunucuya göndermeden ÖNCE burada küçültülür
 * (bu projede dosya depolama/S3 yok, DB'ye base64 olarak yazılıyor —
 * bkz. lib/gamification/meApi.ts uploadMyPhoto). Kare (`size`×`size`)
 * olacak şekilde ORTADAN kırpılır (avatar dairesi için uygun).
 *
 * Tarayıcıya özel (FileReader/Image/canvas) — jsdom'da canvas piksel
 * işleme desteklenmediği için testlerde bu fonksiyon MOCK'lanır, kendisi
 * test edilmez (bkz. tests/profile-photo-upload.test.tsx).
 */
export function resizeImageToDataUrl(file: File, size = 200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Görsel yüklenemedi'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas desteklenmiyor')); return; }
        // Ortadan kare kırpma — en kısa kenar referans alınır.
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
