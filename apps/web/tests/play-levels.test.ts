import { describe, it, expect } from 'vitest';
import { LEVELS, TIME_GROUPS, ALL_TIMES } from '@/lib/play/levels';

describe('LEVELS', () => {
  it('tam 8 seviye vardır', () => expect(LEVELS).toHaveLength(8));

  it('seviye numaraları 1..8 sıralıdır', () => {
    expect(LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('skill_level 0..20 aralığında ve artan sıradadır', () => {
    const skills = LEVELS.map((l) => l.skill);
    expect(skills).toEqual([0, 3, 6, 9, 12, 15, 18, 20]);
    expect(Math.min(...skills)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...skills)).toBeLessThanOrEqual(20);
  });

  it('depth artan sıradadır', () => {
    expect(LEVELS.map((l) => l.depth)).toEqual([1, 3, 5, 7, 8, 9, 11, 12]);
  });
});

describe('TIME_GROUPS', () => {
  it('Süresiz seçeneği YOKTUR (madde g)', () => {
    const labels = TIME_GROUPS.flatMap((g) => g.items).map((i) => i.label);
    expect(labels).not.toContain('Süresiz');
    expect(labels.some((l) => l.toLowerCase().includes('süresiz'))).toBe(false);
  });

  it('üç tempo grubu vardır', () => {
    expect(TIME_GROUPS.map((g) => g.cat)).toEqual(['Yıldırım', 'Hızlı', 'Klasik']);
  });

  it('her temponun pozitif base süresi vardır (süresiz maç olamaz)', () => {
    for (const t of ALL_TIMES) expect(t.base).toBeGreaterThan(0);
  });
});
