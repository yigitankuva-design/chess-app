import { describe, it, expect } from 'vitest';
import { LEVELS, TIME_GROUPS, ALL_TIMES } from '@/lib/play/levels';

describe('LEVELS', () => {
  it('tam 10 seviye vardır', () => expect(LEVELS).toHaveLength(10));

  it('seviye numaraları 1..10 sıralıdır', () => {
    expect(LEVELS.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('skill_level 0..20 aralığındadır', () => {
    const skills = LEVELS.map((l) => l.skill);
    for (const s of skills) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(20);
    }
  });

  it('1-5. seviyelerde hata ihtimali VAR ve azalan sıradadır', () => {
    const chances = LEVELS.slice(0, 5).map((l) => l.blunderChance);
    expect(chances).toEqual([0.6, 0.45, 0.3, 0.15, 0.05]);
    for (let i = 1; i < chances.length; i++) expect(chances[i]).toBeLessThan(chances[i - 1]);
  });

  it('6-10. seviyelerde hata ihtimali YOKTUR (0)', () => {
    const chances = LEVELS.slice(5).map((l) => l.blunderChance);
    expect(chances).toEqual([0, 0, 0, 0, 0]);
  });

  it('6-10. seviyelerde skill artan sıradadır', () => {
    const skills = LEVELS.slice(5).map((l) => l.skill);
    for (let i = 1; i < skills.length; i++) expect(skills[i]).toBeGreaterThan(skills[i - 1]);
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
