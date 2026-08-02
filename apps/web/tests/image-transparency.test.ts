import { describe, it, expect } from 'vitest';
import { floodFillTransparent } from '@/lib/imageTransparency';

function makeImageData(width: number, height: number, pixels: [number, number, number, number][]): {
  width: number; height: number; data: Uint8ClampedArray;
} {
  const data = new Uint8ClampedArray(width * height * 4);
  pixels.forEach(([r, g, b, a], i) => {
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = a;
  });
  return { width, height, data };
}

describe('floodFillTransparent', () => {
  it('kenardan başlayıp beyaz zemini şeffaf yapar, ortadaki şekli korur', () => {
    // 3x3: kenar hepsi beyaz, tam orta siyah (şekil)
    const white: [number, number, number, number] = [255, 255, 255, 255];
    const black: [number, number, number, number] = [0, 0, 0, 255];
    const img = makeImageData(3, 3, [
      white, white, white,
      white, black, white,
      white, white, white,
    ]);
    floodFillTransparent(img, 245);
    const alphaAt = (x: number, y: number) => img.data[(y * 3 + x) * 4 + 3];
    expect(alphaAt(0, 0)).toBe(0);
    expect(alphaAt(1, 1)).toBe(255);
  });

  it('görselin İÇİNDEKİ beyaz alan (dıştan ulaşılamayan) şeffaf YAPILMAZ', () => {
    // 3x3: kenar siyah çerçeve, tam orta beyaz — beyaz nokta dıştan izole
    const white: [number, number, number, number] = [255, 255, 255, 255];
    const black: [number, number, number, number] = [0, 0, 0, 255];
    const img = makeImageData(3, 3, [
      black, black, black,
      black, white, black,
      black, black, black,
    ]);
    floodFillTransparent(img, 245);
    const alphaAt = (x: number, y: number) => img.data[(y * 3 + x) * 4 + 3];
    expect(alphaAt(1, 1)).toBe(255);
    expect(alphaAt(0, 0)).toBe(255);
  });

  it('eşik değerine göre "beyaza yakın" toleransı ayarlanabilir', () => {
    const offWhite: [number, number, number, number] = [250, 250, 250, 255];
    const img = makeImageData(1, 1, [offWhite]);
    floodFillTransparent(img, 245);
    expect(img.data[3]).toBe(0);
  });
});
