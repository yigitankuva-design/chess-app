import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PLACEMENT, clampPlacement, dragToPercent, resizeToPercent, toneToFilter,
  defaultPlacementForIndex,
} from '@/lib/chess/imagePlacement';

describe('imagePlacement', () => {
  it('DEFAULT_PLACEMENT ortalanmış, orta boy, ton 0', () => {
    expect(DEFAULT_PLACEMENT).toEqual({ x: 50, y: 50, w: 40, h: 40, tone: 0 });
  });

  it('clampPlacement değerleri sınırlar içine sıkıştırır', () => {
    expect(clampPlacement({ x: 150, y: -20, w: 2, h: 200, tone: 15 }))
      .toEqual({ x: 100, y: 0, w: 5, h: 90, tone: 10 });
  });

  it('clampPlacement eksik alanları varsayılanla doldurur', () => {
    expect(clampPlacement({})).toEqual(DEFAULT_PLACEMENT);
  });

  it('clampPlacement tone değerini tam sayıya yuvarlar', () => {
    expect(clampPlacement({ tone: 3.6 }).tone).toBe(4);
  });

  it('dragToPercent piksel deltasını tahta boyutuna göre yüzdeye çevirir', () => {
    const start = { x: 50, y: 50, w: 40, h: 40, tone: 0 };
    // 200x200'lük tahtada 20px sağa/aşağı sürükleme = %10
    const next = dragToPercent(start, 20, 20, 200, 200);
    expect(next.x).toBe(60);
    expect(next.y).toBe(60);
  });

  it('dragToPercent tahta kenarında clamp uygular', () => {
    const start = { x: 95, y: 5, w: 40, h: 40, tone: 0 };
    const next = dragToPercent(start, 100, -100, 200, 200);
    expect(next.x).toBe(100);
    expect(next.y).toBe(0);
  });

  it('dragToPercent tahta boyutu 0 ise değiştirmez', () => {
    const start = { x: 50, y: 50, w: 40, h: 40, tone: 0 };
    expect(dragToPercent(start, 20, 20, 0, 0)).toEqual(start);
  });

  it('resizeToPercent köşe deltasını genişlik/yükseklik yüzdesine ekler', () => {
    const start = { x: 50, y: 50, w: 40, h: 40, tone: 0 };
    const next = resizeToPercent(start, 20, 20, 200, 200);
    expect(next.w).toBe(60);
    expect(next.h).toBe(60);
  });

  it('resizeToPercent min/max sınırlarını uygular', () => {
    const start = { x: 50, y: 50, w: 40, h: 40, tone: 0 };
    const next = resizeToPercent(start, -1000, -1000, 200, 200);
    expect(next.w).toBe(5);
    expect(next.h).toBe(5);
  });

  it('toneToFilter 0 için none döner', () => {
    expect(toneToFilter(0)).toBe('none');
  });

  it('toneToFilter 10 için tam gri döner', () => {
    expect(toneToFilter(10)).toBe('grayscale(1)');
  });

  it('toneToFilter 5 için yarı gri döner', () => {
    expect(toneToFilter(5)).toBe('grayscale(0.5)');
  });
});

describe('defaultPlacementForIndex', () => {
  it('ilk görsel tam ortada başlar', () => {
    expect(defaultPlacementForIndex(0)).toEqual({ x: 50, y: 50, w: 40, h: 40, tone: 0 });
  });

  it('sonraki görseller üst üste binmesin diye kaydırılır', () => {
    const p1 = defaultPlacementForIndex(1);
    expect(p1.x).not.toBe(50);
    expect(p1.y).not.toBe(50);
  });

  it('kaydırma tahta sınırları içinde kalır (clamp)', () => {
    for (let i = 0; i < 20; i++) {
      const p = defaultPlacementForIndex(i);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });
});
