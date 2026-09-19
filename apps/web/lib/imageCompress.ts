/**
 * Görseli canvas ile yeniden boyutlandırıp JPEG kalitesini kademeli
 * düşürerek (0.9 → 0.5) maxBytes altına indirir. Hiçbiri sığmazsa hata
 * fırlatır — bozuk/aşırı büyük veri sessizce kaydedilmez.
 *
 * `format: 'png'` (madde 2026-09-19, Özel İkon Yükleme): JPEG şeffaflığı
 * (alpha kanalı) desteklemediği için admin'in yüklediği ikon görselleri
 * (Gemini vb. ile üretilmiş, şeffaf arka planlı illüstrasyonlar) JPEG'e
 * çevrilince arka planları BEYAZA düşüyordu — koyu temalarda çirkin bir
 * kutu gibi görünüyordu. PNG kayıpsız olduğu için kalite kademesi yok;
 * bunun yerine boyut sığana kadar KENAR UZUNLUĞU kademeli küçültülür.
 */
export async function compressImageToDataUri(
  file: File, maxBytes = 400_000, maxDim = 800, format: 'jpeg' | 'png' = 'jpeg',
): Promise<string> {
  const img = await loadImage(file);

  if (format === 'png') {
    let dim = maxDim;
    for (let i = 0; i < 6; i++) {
      const uri = drawToDataUri(img, dim, 'image/png');
      if (new Blob([uri]).size <= maxBytes) return uri;
      dim = Math.round(dim * 0.75);
    }
    throw new Error('Görsel sıkıştırılamadı');
  }

  for (let quality = 0.9; quality >= 0.5; quality -= 0.1) {
    const uri = drawToDataUri(img, maxDim, 'image/jpeg', quality);
    if (new Blob([uri]).size <= maxBytes) return uri;
  }
  throw new Error('Görsel sıkıştırılamadı');
}

function drawToDataUri(img: HTMLImageElement, maxDim: number, mime: string, quality?: number): string {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas desteklenmiyor');
  ctx.drawImage(img as unknown as CanvasImageSource, 0, 0, w, h);
  return canvas.toDataURL(mime, quality);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel okunamadı'));
    img.src = URL.createObjectURL(file);
  });
}
