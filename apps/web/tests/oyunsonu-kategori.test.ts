import { describe, it, expect } from 'vitest';
import {
  OYUNSONU_CATEGORIES, KATEGORISIZ, groupByCategory,
} from '@/lib/customTabs/pratikYap';

describe('Oyunsonu kategorileri', () => {
  it('beş kategori doğru sırayla tanımlıdır', () => {
    expect(OYUNSONU_CATEGORIES).toEqual([
      'Piyon Finalleri',
      'Kale Finalleri',
      'Hafif Taşlar Arası Mücadele',
      'Ağır Taşlar Arası Mücadele',
      'Ağır Taşlar ile Hafif Taşlar Arası Mücadele',
    ]);
  });

  it('konumları kategorilerine göre gruplar', () => {
    const poz = [
      { id: 'a', fen: 'x', category: 'Kale Finalleri' },
      { id: 'b', fen: 'y', category: 'Piyon Finalleri' },
      { id: 'c', fen: 'z', category: 'Kale Finalleri' },
    ];
    const g = groupByCategory(poz);
    expect(g['Piyon Finalleri'].map((p) => p.id)).toEqual(['b']);
    expect(g['Kale Finalleri'].map((p) => p.id)).toEqual(['a', 'c']);
    expect(g['Ağır Taşlar Arası Mücadele']).toEqual([]);
  });

  it('kategorisi olmayan konumlar ayrı grupta toplanır', () => {
    const g = groupByCategory([
      { id: 'a', fen: 'x' },
      { id: 'b', fen: 'y', category: 'Piyon Finalleri' },
    ]);
    expect(g[KATEGORISIZ].map((p) => p.id)).toEqual(['a']);
    expect(g['Piyon Finalleri'].map((p) => p.id)).toEqual(['b']);
  });

  it('bilinmeyen bir kategori de kategorisiz sayılır', () => {
    const g = groupByCategory([{ id: 'a', fen: 'x', category: 'Uydurma Kategori' }]);
    expect(g[KATEGORISIZ].map((p) => p.id)).toEqual(['a']);
  });

  it('boş listede tüm gruplar boştur', () => {
    const g = groupByCategory([]);
    for (const c of OYUNSONU_CATEGORIES) expect(g[c]).toEqual([]);
    expect(g[KATEGORISIZ]).toEqual([]);
  });
});
