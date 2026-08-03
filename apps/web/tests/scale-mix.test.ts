import { describe, it, expect } from 'vitest';
import { scaleMix, UNTIMED_MIX, TIMED_MIX, TEST_MIX } from '@/lib/play/questionPicker';

describe('scaleMix — oranı koruyarak hedef sayıya ölçekler', () => {
  it('hedef mevcut toplama eşitse mix aynen döner', () => {
    expect(scaleMix(UNTIMED_MIX, 20)).toEqual(UNTIMED_MIX);
  });

  it('toplam her zaman hedef sayıya eşittir', () => {
    for (const mix of [UNTIMED_MIX, TIMED_MIX, TEST_MIX]) {
      for (const target of [1, 2, 5, 8, 15, 20, 30, 50]) {
        const scaled = scaleMix(mix, target);
        expect(scaled.easy + scaled.medium + scaled.hard).toBe(target);
      }
    }
  });

  it('küçültünce oran korunur (kolay her zaman en büyük pay olur)', () => {
    const scaled = scaleMix(UNTIMED_MIX, 10); // 10:7:3 oranı, hedef 10
    expect(scaled.easy).toBeGreaterThanOrEqual(scaled.medium);
    expect(scaled.medium).toBeGreaterThanOrEqual(scaled.hard);
  });

  it('büyütünce de toplam hedefe eşit kalır', () => {
    expect(scaleMix(TEST_MIX, 50).easy + scaleMix(TEST_MIX, 50).medium + scaleMix(TEST_MIX, 50).hard).toBe(50);
  });

  it('hedef 0 veya negatifse hepsi sıfır olur', () => {
    expect(scaleMix(UNTIMED_MIX, 0)).toEqual({ easy: 0, medium: 0, hard: 0 });
  });

  it('kova sayıları negatif olamaz', () => {
    const scaled = scaleMix(UNTIMED_MIX, 1);
    expect(scaled.easy).toBeGreaterThanOrEqual(0);
    expect(scaled.medium).toBeGreaterThanOrEqual(0);
    expect(scaled.hard).toBeGreaterThanOrEqual(0);
  });
});
