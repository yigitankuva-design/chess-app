import ImageTracer from 'imagetracerjs';

/**
 * Raster görseli (data: URI) otomatik SVG çizgilerine çevirir (potrace-benzeri
 * izleme). Basit ikon/çizim tarzı görsellerde iyi çalışır; fotoğraflarda
 * detay kaybıyla çizgi-tabanlı bir sonuç üretir — bu kütüphanenin doğası,
 * hata değil. Tamamen tarayıcı-taraflı, sunucuya hiçbir şey eklenmez.
 */
export function vectorizeImage(dataUri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      ImageTracer.imageToSVG(dataUri, (svgstring: string) => {
        const encoded = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgstring)))}`;
        resolve(encoded);
      });
    } catch (e) {
      reject(e instanceof Error ? e : new Error('Vektörleştirme başarısız'));
    }
  });
}
