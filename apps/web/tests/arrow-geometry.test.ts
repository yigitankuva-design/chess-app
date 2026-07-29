import { describe, it, expect } from 'vitest';
import { squareCenter, arrowLine } from '@/lib/chess/arrowGeometry';

describe('squareCenter', () => {
  it('beyaz yönde a8 sol üst, h1 sağ alt karedir', () => {
    expect(squareCenter('a8', 'white')).toEqual({ x: 0.5, y: 0.5 });
    expect(squareCenter('h1', 'white')).toEqual({ x: 7.5, y: 7.5 });
  });

  it('siyah yönde tahta ters döner', () => {
    expect(squareCenter('a8', 'black')).toEqual({ x: 7.5, y: 7.5 });
    expect(squareCenter('h1', 'black')).toEqual({ x: 0.5, y: 0.5 });
  });

  it('geçersiz kare null döner', () => {
    expect(squareCenter('z9', 'white')).toBeNull();
    expect(squareCenter('', 'white')).toBeNull();
    expect(squareCenter('e', 'white')).toBeNull();
  });
});

describe('arrowLine — At oku DÜZ çizilir (madde 7)', () => {
  it('g1–f3 At hamlesi tek doğru parçasıdır, köşe YOKTUR', () => {
    const l = arrowLine('g1', 'f3', 'white')!;
    // Duz cizgi: baslangic ve bitis noktalari, kare merkezleri arasindaki
    // dogrunun UZERINDE olmali (kose noktasi olsaydi egim bozulurdu).
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    // g1 -> f3: bir sola, iki yukari  => egim dy/dx = -2 / -1 = 2
    expect(dy / dx).toBeCloseTo(2, 6);
  });

  it('ok hedefin merkezine varmadan durur, çıkışta boşluk bırakır', () => {
    const l = arrowLine('e2', 'e4', 'white')!;
    // e2 merkezi y=6.5, e4 merkezi y=4.5
    expect(l.y1).toBeLessThan(6.5);
    expect(l.y2).toBeGreaterThan(4.5);
    expect(l.x1).toBeCloseTo(4.5, 6);
    expect(l.x2).toBeCloseTo(4.5, 6);
  });

  it('aynı kareye ok çizilmez', () => {
    expect(arrowLine('e4', 'e4', 'white')).toBeNull();
  });

  it('geçersiz karede null döner', () => {
    expect(arrowLine('e4', 'zz', 'white')).toBeNull();
  });
});
