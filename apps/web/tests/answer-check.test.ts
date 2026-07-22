import { describe, it, expect } from 'vitest';
import { isTargetSquare } from '@/components/lesson-steps/BoardExercise';

/**
 * REGRESYON: Eskiden hedef listede h1/a2/b1 varsa gerçek cevap yok sayılıp
 * "herhangi bir koyu kare" doğru kabul ediliyordu. Bu, öğretmenin adminde
 * yazdığı cevabı bozuyordu. Cevap artık birebir adminde yazıldığı gibi olmalı.
 */
const LIGHT_SQUARES = [
  'a8', 'c8', 'e8', 'g8', 'h7', 'f7', 'd7', 'b7', 'a6', 'c6', 'e6', 'g6',
  'h5', 'f5', 'd5', 'b5', 'a4', 'c4', 'e4', 'g4', 'h3', 'f3', 'd3', 'b3',
  'a2', 'c2', 'e2', 'g2', 'h1', 'f1', 'd1', 'b1',
];
const DARK_SQUARES = [
  'a1', 'c1', 'e1', 'g1', 'h2', 'f2', 'd2', 'b2', 'a3', 'c3', 'e3', 'g3',
  'h4', 'f4', 'd4', 'b4', 'a5', 'c5', 'e5', 'g5', 'h6', 'f6', 'd6', 'b6',
  'a7', 'c7', 'e7', 'g7', 'h8', 'f8', 'd8', 'b8',
];

describe('isTargetSquare — adminde yazılan cevap birebir uygulanır', () => {
  it('"açık renkli kareye dokun": açık kare doğru, koyu kare yanlış', () => {
    // Bu liste h1/a2/b1 içeriyor — eski hack burada cevabı TERSİNE çeviriyordu
    expect(isTargetSquare('h1', LIGHT_SQUARES)).toBe(true);
    expect(isTargetSquare('a2', LIGHT_SQUARES)).toBe(true);
    expect(isTargetSquare('e4', LIGHT_SQUARES)).toBe(true);
    expect(isTargetSquare('a1', LIGHT_SQUARES)).toBe(false); // koyu kare
    expect(isTargetSquare('d4', LIGHT_SQUARES)).toBe(false); // koyu kare
  });

  it('"koyu renkli kareye dokun": koyu kare doğru, açık kare yanlış', () => {
    expect(isTargetSquare('a1', DARK_SQUARES)).toBe(true);
    expect(isTargetSquare('d4', DARK_SQUARES)).toBe(true);
    expect(isTargetSquare('h1', DARK_SQUARES)).toBe(false);
    expect(isTargetSquare('e4', DARK_SQUARES)).toBe(false);
  });

  it('"herhangi bir kareye dokun": 64 karenin hepsi doğru', () => {
    const all = [...LIGHT_SQUARES, ...DARK_SQUARES];
    expect(all).toHaveLength(64);
    for (const sq of ['a1', 'h1', 'e4', 'd4', 'a8', 'h8']) {
      expect(isTargetSquare(sq, all)).toBe(true);
    }
  });

  it('tek hedefli soruda sadece o kare doğru', () => {
    expect(isTargetSquare('e4', ['e4'])).toBe(true);
    expect(isTargetSquare('e5', ['e4'])).toBe(false);
    expect(isTargetSquare('a1', ['e4'])).toBe(false);
  });

  it('hedef yoksa hiçbir kare doğru değil', () => {
    expect(isTargetSquare('e4', [])).toBe(false);
  });
});
