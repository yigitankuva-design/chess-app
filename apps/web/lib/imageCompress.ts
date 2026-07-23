/**
 * Görseli canvas ile yeniden boyutlandırıp (maks. 800px kenar) JPEG kalitesini
 * kademeli düşürerek (0.9 → 0.5) maxBytes altına indirir. Hiçbiri sığmazsa hata fırlatır
 * — bozuk/aşırı büyük veri sessizce kaydedilmez.
 */
export async function compressImageToDataUri(file: File, maxBytes = 400_000): Promise<string> {
  const img = await loadImage(file);
  const maxDim = 800;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas desteklenmiyor');
  ctx.drawImage(img as unknown as CanvasImageSource, 0, 0, w, h);

  for (let quality = 0.9; quality >= 0.5; quality -= 0.1) {
    const uri = canvas.toDataURL('image/jpeg', quality);
    if (new Blob([uri]).size <= maxBytes) return uri;
  }
  throw new Error('Görsel sıkıştırılamadı');
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Görsel okunamadı'));
    img.src = URL.createObjectURL(file);
  });
}
