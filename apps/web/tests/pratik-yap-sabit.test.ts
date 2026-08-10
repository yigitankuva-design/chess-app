import { describe, it, expect } from 'vitest';
import {
  PRATIK_YAP_LABEL, OPENING_ROW, FIXED_SECTIONS,
  isFixedSection, sectionEmoji, sortPratikSections,
} from '@/lib/customTabs/pratikYap';

describe('pratikYap sabitleri', () => {
  it('sekme adı ve açılış satırı beklenen değerlerdedir', () => {
    expect(PRATIK_YAP_LABEL).toBe('Pratik Yap');
    expect(OPENING_ROW.title).toBe('Açılış Pratiği Yap');
    expect(OPENING_ROW.emoji).toBe('📖');
  });

  it('iki sabit alt sekme sırayla tanımlıdır', () => {
    expect(FIXED_SECTIONS.map((s) => s.title)).toEqual([
      'Kazanç Konumunu Pratik Yap',
      'Oyunsonu Pratiği Yap',
    ]);
  });

  it('isFixedSection sabit adları tanır, diğerlerini tanımaz', () => {
    expect(isFixedSection('Kazanç Konumunu Pratik Yap')).toBe(true);
    expect(isFixedSection('Oyunsonu Pratiği Yap')).toBe(true);
    expect(isFixedSection('Hocanın Sekmesi')).toBe(false);
  });

  it('sectionEmoji sabitlere ikon verir, diğerlerine vermez', () => {
    expect(sectionEmoji('Kazanç Konumunu Pratik Yap')).toBe('🏆');
    expect(sectionEmoji('Oyunsonu Pratiği Yap')).toBe('🏁');
    expect(sectionEmoji('Hocanın Sekmesi')).toBeNull();
  });

  it('sortPratikSections sabitleri öne, diğerlerini arkaya alır', () => {
    const list = [
      { title: 'Hocanın Sekmesi' },
      { title: 'Oyunsonu Pratiği Yap' },
      { title: 'Başka Sekme' },
      { title: 'Kazanç Konumunu Pratik Yap' },
    ];
    expect(sortPratikSections(list).map((s) => s.title)).toEqual([
      'Kazanç Konumunu Pratik Yap',
      'Oyunsonu Pratiği Yap',
      'Hocanın Sekmesi',
      'Başka Sekme',
    ]);
  });

  it('sabitler eksikken de hocanınkilerin sırası korunur', () => {
    const list = [{ title: 'A' }, { title: 'B' }];
    expect(sortPratikSections(list).map((s) => s.title)).toEqual(['A', 'B']);
  });
});
