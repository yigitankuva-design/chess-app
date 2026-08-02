import { describe, it, expect } from 'vitest';
import { ringStyle, RING_BLUE, RING_GREEN, RING_RED } from '@/lib/chess/squareMarker';

describe('ringStyle', () => {
  it('kareyi BOYAMAZ — backgroundColor üretmez', () => {
    const s = ringStyle(RING_BLUE);
    expect(s.backgroundColor).toBeUndefined();
  });

  it('verilen rengi içeren yuvarlak bir kenarlık üretir', () => {
    const s = ringStyle(RING_GREEN);
    expect(s.borderRadius).toBe('50%');
    expect(s.border).toContain(RING_GREEN);
  });

  it('halkanın ortası boştur — taş görünmeye devam eder', () => {
    const s = ringStyle(RING_RED);
    expect(s.backgroundImage).toBeUndefined();
    expect(s.boxSizing).toBe('border-box');
  });

  it('üç renk birbirinden farklıdır', () => {
    expect(new Set([RING_BLUE, RING_GREEN, RING_RED]).size).toBe(3);
  });
});
