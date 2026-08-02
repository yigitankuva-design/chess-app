import { describe, it, expect } from 'vitest';
import { evaluatePlacement, allPlaced } from '@/lib/play/placePieces';
import type { PiecePlacement } from '@/lib/play/placePieces';

const pending: PiecePlacement[] = [
  { piece: 'Q', square: 'h5' },
  { piece: 'N', square: 'c6' },
];

describe('evaluatePlacement — sıra serbest, tek hak', () => {
  it('doğru taş doğru kareye konunca kabul edilir ve listeden düşer', () => {
    const r = evaluatePlacement(pending, 'N', 'c6');
    expect(r.ok).toBe(true);
    expect(r.remaining).toEqual([{ piece: 'Q', square: 'h5' }]);
  });

  it('ikinci taş da doğru konunca liste boşalır', () => {
    const r1 = evaluatePlacement(pending, 'N', 'c6');
    const r2 = evaluatePlacement(r1.remaining, 'Q', 'h5');
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toEqual([]);
  });

  it('doğru taş YANLIŞ kareye konursa reddedilir, liste değişmez', () => {
    const r = evaluatePlacement(pending, 'Q', 'a1');
    expect(r.ok).toBe(false);
    expect(r.remaining).toEqual(pending);
  });

  it('listede olmayan taş reddedilir', () => {
    const r = evaluatePlacement(pending, 'R', 'h5');
    expect(r.ok).toBe(false);
  });

  it('aynı taştan iki tane varsa kareye göre ayrışır', () => {
    const two: PiecePlacement[] = [
      { piece: 'R', square: 'a1' },
      { piece: 'R', square: 'h1' },
    ];
    const r = evaluatePlacement(two, 'R', 'h1');
    expect(r.ok).toBe(true);
    expect(r.remaining).toEqual([{ piece: 'R', square: 'a1' }]);
  });

  it('girdi listesini DEĞİŞTİRMEZ (saf fonksiyon)', () => {
    const copy = [...pending];
    evaluatePlacement(pending, 'N', 'c6');
    expect(pending).toEqual(copy);
  });
});

describe('allPlaced', () => {
  it('liste boşsa bitmiştir', () => {
    expect(allPlaced([])).toBe(true);
  });
  it('liste doluysa bitmemiştir', () => {
    expect(allPlaced(pending)).toBe(false);
  });
});
