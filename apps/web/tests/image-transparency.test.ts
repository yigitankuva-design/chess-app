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

import { removeBackground } from '@/lib/imageTransparency';

/** 3x3 görsel üret: köşeler zemin rengi, orta piksel ikon. RGBA düz dizi. */
function makeImg(bg: [number, number, number], center: [number, number, number]) {
  const w = 3, h = 3;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const isCenter = i === 4;
    const [r, g, b] = isCenter ? center : bg;
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe('removeBackground — köşe rengini örnekleyip siler (madde 4)', () => {
  it('DÜZ BEYAZ zemin şeffaflaşır, ikon kalır', () => {
    const img = makeImg([255, 255, 255], [10, 20, 30]);
    removeBackground(img, 40);
    expect(img.data[0 * 4 + 3]).toBe(0);      // köşe şeffaf
    expect(img.data[4 * 4 + 3]).toBe(255);    // orta (ikon) opak
  });

  it('AÇIK GRI zemin de şeffaflaşır (eski eşik bunu kaçırıyordu)', () => {
    const img = makeImg([238, 240, 236], [10, 20, 30]);
    removeBackground(img, 40);
    expect(img.data[0 * 4 + 3]).toBe(0);      // açık gri köşe şeffaf
    expect(img.data[4 * 4 + 3]).toBe(255);    // ikon opak
  });

  it('zemin rengindeki orta piksel de (kenara bitişikse) silinir', () => {
    const img = makeImg([255, 255, 255], [255, 255, 255]);
    removeBackground(img, 40);
    expect(img.data[4 * 4 + 3]).toBe(0);
  });

  it('tolerans DIŞINDA kalan renk silinmez', () => {
    const img = makeImg([255, 255, 255], [10, 20, 30]);
    removeBackground(img, 5); // çok dar tolerans
    expect(img.data[4 * 4 + 3]).toBe(255);    // ikon kesin kalır
  });
});
