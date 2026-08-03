import { describe, it, expect } from 'vitest';
import {
  PALETTE, SHAPES, newTextItem, newShapeItem, dragItem, resizeItem, rotateItem,
  clampCoord, clampSize, clampFontSize, clampRotation,
} from '@/lib/chess/paintItems';
import type { ShapePaintItem } from '@/lib/chess/paintItems';

describe('paintItems — sabitler', () => {
  it('10 renk içerir', () => expect(PALETTE).toHaveLength(10));
  it('6 şekil içerir', () => expect(SHAPES).toHaveLength(6));
});

describe('paintItems — sınırlama fonksiyonları', () => {
  it('koordinat 0-100 arasına sıkıştırılır', () => {
    expect(clampCoord(-5)).toBe(0);
    expect(clampCoord(150)).toBe(100);
    expect(clampCoord(50)).toBe(50);
  });
  it('boyut 2-90 arasına sıkıştırılır', () => {
    expect(clampSize(0)).toBe(2);
    expect(clampSize(200)).toBe(90);
  });
  it('punto 12-72 arasına sıkıştırılır', () => {
    expect(clampFontSize(1)).toBe(12);
    expect(clampFontSize(999)).toBe(72);
  });
  it('döndürme 0-359 arasına normalize edilir', () => {
    expect(clampRotation(-10)).toBe(350);
    expect(clampRotation(370)).toBe(10);
  });
});

describe('paintItems — oluşturma', () => {
  it('newTextItem varsayılan yazı ve punto ile döner', () => {
    const t = newTextItem(50, 50, '#ef4444');
    expect(t.kind).toBe('text');
    expect(t.text).toBe('Yazı');
    expect(t.fontSize).toBe(24);
    expect(t.color).toBe('#ef4444');
    expect(t.id).toBeTruthy();
  });
  it('newShapeItem varsayılan boyutla döner', () => {
    const s = newShapeItem('circle', 30, 40, '#3b82f6');
    expect(s.kind).toBe('shape');
    expect(s.shape).toBe('circle');
    expect(s.w).toBe(15);
    expect(s.h).toBe(15);
  });
  it('iki öğenin id\'si farklıdır', () => {
    const a = newTextItem(0, 0, '#000000');
    const b = newTextItem(0, 0, '#000000');
    expect(a.id).not.toBe(b.id);
  });
});

describe('paintItems — sürükleme/boyutlandırma/döndürme', () => {
  const shape: ShapePaintItem = { id: 'x', kind: 'shape', shape: 'square', x: 50, y: 50, w: 20, h: 20, rotation: 0, color: '#000000' };

  it('dragItem piksel deltasını yüzdeye çevirip merkeze ekler', () => {
    const next = dragItem(shape, 50, 0, 200, 200);
    expect(next.x).toBe(75);
    expect(next.y).toBe(50);
  });
  it('resizeItem genişlik/yüksekliği büyütür', () => {
    const next = resizeItem(shape, 20, 20, 200, 200) as ShapePaintItem;
    expect(next.w).toBeGreaterThan(20);
    expect(next.h).toBeGreaterThan(20);
  });
  it('rotateItem işaretçi konumuna göre açı hesaplar', () => {
    const next = rotateItem(shape, 100, 100, 150, 100);
    expect(next.rotation).toBeCloseTo(90, 0);
  });
});
