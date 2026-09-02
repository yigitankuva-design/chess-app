import { describe, it, expect } from 'vitest';
import {
  PRATIK_YAP_LABEL, OPENING_ROW, OPENING_KIND, KAZANC_KIND, OYUNSONU_KIND, FIXED_SECTIONS,
  isFixedSection, sectionEmoji, sortPratikSections,
} from '@/lib/customTabs/pratikYap';

describe('pratikYap sabitleri', () => {
  it('sekme adı ve açılış satırı beklenen değerlerdedir', () => {
    expect(PRATIK_YAP_LABEL).toBe('Pratik Yap');
    expect(OPENING_ROW.title).toBe('Açılış Pratiği Yap');
    expect(OPENING_ROW.emoji).toBe('📖');
    expect(OPENING_ROW.kind).toBe(OPENING_KIND);
  });

  it('üç sabit alt sekme tanımlıdır (madde 2026-09-02: Açılış da gerçek kayıt oldu)', () => {
    expect(FIXED_SECTIONS.map((s) => s.kind)).toEqual([OPENING_KIND, KAZANC_KIND, OYUNSONU_KIND]);
    expect(FIXED_SECTIONS.map((s) => s.title)).toEqual([
      'Açılış Pratiği Yap',
      'Kazanç Konumunu Pratik Yap',
      'Oyunsonu Pratiği Yap',
    ]);
  });

  it('isFixedSection section_kind\'e bakar (madde 2026-09-02 (2): title\'a DEĞİL — admin adı değiştirebilir)', () => {
    expect(isFixedSection(OPENING_KIND)).toBe(true);
    expect(isFixedSection(KAZANC_KIND)).toBe(true);
    expect(isFixedSection(OYUNSONU_KIND)).toBe(true);
    expect(isFixedSection(null)).toBe(false);
    expect(isFixedSection(undefined)).toBe(false);
    expect(isFixedSection('bilinmeyen')).toBe(false);
    // Ad değişse bile (title artık serbest) section_kind SABİT kalır.
    expect(isFixedSection('opening')).toBe(true);
  });

  it('sectionEmoji sabitlere ikon verir, diğerlerine vermez', () => {
    expect(sectionEmoji(OPENING_KIND)).toBe('📖');
    expect(sectionEmoji(KAZANC_KIND)).toBe('🏆');
    expect(sectionEmoji(OYUNSONU_KIND)).toBe('🏁');
    expect(sectionEmoji(null)).toBeNull();
    expect(sectionEmoji('bilinmeyen')).toBeNull();
  });

  it('sortPratikSections sabitleri KENDİ order_index\'lerine göre öne, diğerlerini arkaya alır (madde 2026-09-02)', () => {
    const list = [
      { title: 'Hocanın Sekmesi', section_kind: null, order_index: 1 },
      { title: 'Oyunsonu Pratiği Yap', section_kind: OYUNSONU_KIND, order_index: 1 },
      { title: 'Başka Sekme', section_kind: null, order_index: 2 },
      { title: 'Kazanç Konumunu Pratik Yap', section_kind: KAZANC_KIND, order_index: 2 },
      { title: 'Yeniden Adlandırılmış Açılış', section_kind: OPENING_KIND, order_index: 3 },
    ];
    // order_index'e göre: Oyunsonu(1) < Kazanç(2) < Açılış(3) — admin bunu
    // Yukarı/Aşağı ile değiştirebilir, artık sabit dizi sırası DEĞİL. Açılış
    // burada adı DEĞİŞTİRİLMİŞ olsa bile (section_kind sabit kaldığı için)
    // doğru şekilde "sabit" grubunda kalıyor.
    expect(sortPratikSections(list).map((s) => s.title)).toEqual([
      'Oyunsonu Pratiği Yap',
      'Kazanç Konumunu Pratik Yap',
      'Yeniden Adlandırılmış Açılış',
      'Hocanın Sekmesi',
      'Başka Sekme',
    ]);
  });

  it('sabitler eksikken de hocanınkilerin sırası korunur', () => {
    const list = [
      { title: 'A', section_kind: null, order_index: 1 },
      { title: 'B', section_kind: null, order_index: 2 },
    ];
    expect(sortPratikSections(list).map((s) => s.title)).toEqual(['A', 'B']);
  });
});
