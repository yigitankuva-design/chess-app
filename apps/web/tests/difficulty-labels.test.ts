import { describe, it, expect } from 'vitest';
import { DIFFICULTY_LABELS, nearestDifficultyValue } from '@/lib/difficultyLabels';

describe('DIFFICULTY_LABELS', () => {
  it('üç etiket içerir: Kolay(1), Orta(3), Zor(5)', () => {
    expect(DIFFICULTY_LABELS).toEqual([[1, 'Kolay'], [3, 'Orta'], [5, 'Zor']]);
  });
});

describe('nearestDifficultyValue', () => {
  it('1 ve 2 → Kolay(1)', () => {
    expect(nearestDifficultyValue(1)).toBe(1);
    expect(nearestDifficultyValue(2)).toBe(1);
  });
  it('3 → Orta(3)', () => expect(nearestDifficultyValue(3)).toBe(3));
  it('4 ve 5 → Zor(5)', () => {
    expect(nearestDifficultyValue(4)).toBe(5);
    expect(nearestDifficultyValue(5)).toBe(5);
  });
});
