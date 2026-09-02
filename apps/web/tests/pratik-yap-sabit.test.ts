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

  it('üç sabit alt sekme tanımlıdır (madde 2026-09-02: Açılış da gerçek kayıt oldu)', () => {
    expect(FIXED_SECTIONS.map((s) => s.title)).toEqual([
      'Açılış Pratiği Yap',
      'Kazanç Konumunu Pratik Yap',
      'Oyunsonu Pratiği Yap',
    ]);
  });

  it('isFixedSection sabit adları tanır, diğerlerini tanımaz', () => {
    expect(isFixedSection('Açılış Pratiği Yap')).toBe(true);
    expect(isFixedSection('Kazanç Konumunu Pratik Yap')).toBe(true);
    expect(isFixedSection('Oyunsonu Pratiği Yap')).toBe(true);
    expect(isFixedSection('Hocanın Sekmesi')).toBe(false);
  });

  it('sectionEmoji sabitlere ikon verir, diğerlerine vermez', () => {
    expect(sectionEmoji('Açılış Pratiği Yap')).toBe('📖');
    expect(sectionEmoji('Kazanç Konumunu Pratik Yap')).toBe('🏆');
    expect(sectionEmoji('Oyunsonu Pratiği Yap')).toBe('🏁');
    expect(sectionEmoji('Hocanın Sekmesi')).toBeNull();
  });

  it('sortPratikSections sabitleri KENDİ order_index\'lerine göre öne, diğerlerini arkaya alır (madde 2026-09-02)', () => {
    const list = [
      { title: 'Hocanın Sekmesi', order_index: 1 },
      { title: 'Oyunsonu Pratiği Yap', order_index: 1 },
      { title: 'Başka Sekme', order_index: 2 },
      { title: 'Kazanç Konumunu Pratik Yap', order_index: 2 },
      { title: 'Açılış Pratiği Yap', order_index: 3 },
    ];
    // order_index'e göre: Oyunsonu(1) < Kazanç(2) < Açılış(3) — admin bunu
    // Yukarı/Aşağı ile değiştirebilir, artık sabit dizi sırası DEĞİL.
    expect(sortPratikSections(list).map((s) => s.title)).toEqual([
      'Oyunsonu Pratiği Yap',
      'Kazanç Konumunu Pratik Yap',
      'Açılış Pratiği Yap',
      'Hocanın Sekmesi',
      'Başka Sekme',
    ]);
  });

  it('sabitler eksikken de hocanınkilerin sırası korunur', () => {
    const list = [{ title: 'A', order_index: 1 }, { title: 'B', order_index: 2 }];
    expect(sortPratikSections(list).map((s) => s.title)).toEqual(['A', 'B']);
  });
});
