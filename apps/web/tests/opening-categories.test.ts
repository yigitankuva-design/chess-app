import { describe, it, expect } from 'vitest';
import {
  OPENING_CATEGORIES, normalizeCategory, categoryTitle, groupOpenings,
} from '@/lib/play/openingCategories';

describe('açılış kategorileri', () => {
  it('üç tür sırayla tanımlıdır', () => {
    expect(OPENING_CATEGORIES.map((c) => c.key)).toEqual(['e4', 'd4', 'diger']);
    expect(OPENING_CATEGORIES.map((c) => c.title)).toEqual([
      'e4 ile Başlayanlar', 'd4 ile Başlayanlar', 'Diğerleri',
    ]);
  });

  it('bilinen değerleri aynen döndürür', () => {
    expect(normalizeCategory('e4')).toBe('e4');
    expect(normalizeCategory('d4')).toBe('d4');
    expect(normalizeCategory('diger')).toBe('diger');
  });

  it('TUZAK: bilinmeyen, boş ve null değerler "diger" olur', () => {
    expect(normalizeCategory('c4')).toBe('diger');
    expect(normalizeCategory('')).toBe('diger');
    expect(normalizeCategory(null)).toBe('diger');
    expect(normalizeCategory(undefined)).toBe('diger');
  });

  it('categoryTitle başlığı verir', () => {
    expect(categoryTitle('d4')).toBe('d4 ile Başlayanlar');
  });

  it('groupOpenings üç anahtarı her zaman döndürür', () => {
    const g = groupOpenings([]);
    expect(Object.keys(g).sort()).toEqual(['d4', 'diger', 'e4']);
    expect(g.e4).toEqual([]);
  });

  it('groupOpenings kategoriye göre ayırır, sıra korunur', () => {
    const g = groupOpenings([
      { id: 1, category: 'e4' }, { id: 2, category: 'd4' },
      { id: 3, category: 'e4' }, { id: 4, category: null },
    ]);
    expect(g.e4.map((o) => o.id)).toEqual([1, 3]);
    expect(g.d4.map((o) => o.id)).toEqual([2]);
    expect(g.diger.map((o) => o.id)).toEqual([4]);
  });
});
