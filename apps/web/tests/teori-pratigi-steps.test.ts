import { describe, it, expect } from 'vitest';
import { teoriPratigiSteps } from '@/lib/admin/teoriPratigiSteps';
import { firstIncomplete, allDone } from '@/lib/admin/questionSteps';
import type { TeoriPratigiStepState } from '@/lib/admin/teoriPratigiSteps';

const EMPTY = '8/8/8/8/8/8/8/8 w - - 0 1';
const TWO_SIDED = '6k1/8/5K2/8/5R2/8/8/8 w - - 0 1';

const BLANK: TeoriPratigiStepState = {
  instruction: '',
  setupFen: EMPTY,
  fen: null,
  moves: [],
  notationSaved: false,
  openingName: '',
  studentColorChosen: false,
};

const FULL: TeoriPratigiStepState = {
  instruction: 'İtalyan Açılışı\'nın ilk hamlelerini oyna',
  setupFen: TWO_SIDED,
  fen: TWO_SIDED,
  moves: ['Rh4'],
  notationSaved: true,
  openingName: 'İtalyan Açılışı',
  studentColorChosen: true,
};

describe('teoriPratigiSteps', () => {
  it('sekiz adım döner, sıra numaraları 1-8 olur', () => {
    const steps = teoriPratigiSteps(BLANK);
    expect(steps).toHaveLength(8);
    expect(steps.map((s) => s.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('adım etiketleri Zafer\'in belirttiği sırayla', () => {
    expect(teoriPratigiSteps(BLANK).map((s) => s.label)).toEqual([
      'Talimatı Gir',
      'Konum Diz',
      'Konumu Kaydet',
      'Cevap Hamlelerini Yap ve Notasyon Oluştur',
      'Notasyonu Kaydet',
      'Açılış veya Varyantın Adını Gir',
      'Hamle Sırasını Belirle',
      'Soruyu Ekle',
    ]);
  });

  it('boş durumda hiçbir adım tamamlanmamıştır', () => {
    expect(teoriPratigiSteps(BLANK).every((s) => !s.done)).toBe(true);
  });

  it('tam durumda sekiz adım da tamamlanmıştır', () => {
    expect(teoriPratigiSteps(FULL).every((s) => s.done)).toBe(true);
  });

  it('TUZAK: adım 2 boş tahtada tamamlanmaz, taş dizilince tamamlanır', () => {
    expect(teoriPratigiSteps(BLANK)[1].done).toBe(false);
    expect(teoriPratigiSteps({ ...BLANK, setupFen: TWO_SIDED })[1].done).toBe(true);
  });

  it('adım 3 konum kaydedilince (fen !== null) tamamlanır', () => {
    expect(teoriPratigiSteps({ ...BLANK, fen: TWO_SIDED })[2].done).toBe(true);
  });

  it('adım 4 en az bir hamle varsa tamamlanır', () => {
    expect(teoriPratigiSteps({ ...BLANK, moves: ['e4'] })[3].done).toBe(true);
  });

  it('adım 5 notasyon kaydedilince tamamlanır', () => {
    expect(teoriPratigiSteps({ ...BLANK, notationSaved: true })[4].done).toBe(true);
  });

  it('adım 6 açılış adı girilince tamamlanır', () => {
    expect(teoriPratigiSteps({ ...BLANK, openingName: 'İtalyan Açılışı' })[5].done).toBe(true);
    expect(teoriPratigiSteps({ ...BLANK, openingName: '   ' })[5].done).toBe(false);
  });

  it('TUZAK: adım 7 sporcunun rengi BİLFİİL seçilmeden tamamlanmaz', () => {
    expect(teoriPratigiSteps(BLANK)[6].done).toBe(false);
    expect(teoriPratigiSteps({ ...BLANK, studentColorChosen: true })[6].done).toBe(true);
  });

  it('Soruyu Ekle (8) yalnızca öncekilerin hepsi bitince tamamlanır', () => {
    expect(teoriPratigiSteps(FULL)[7].done).toBe(true);
    expect(teoriPratigiSteps({ ...FULL, notationSaved: false })[7].done).toBe(false);
  });
});

describe('teoriPratigiSteps + firstIncomplete/allDone (questionSteps.ts, paylaşılan)', () => {
  it('boş durumda ilk eksik adım 1. adımdır', () => {
    expect(firstIncomplete(teoriPratigiSteps(BLANK))?.no).toBe(1);
  });

  it('tam durumda eksik adım yoktur', () => {
    expect(firstIncomplete(teoriPratigiSteps(FULL))).toBeNull();
  });

  it('allDone yalnızca hepsi tamamsa true döner', () => {
    expect(allDone(teoriPratigiSteps(BLANK))).toBe(false);
    expect(allDone(teoriPratigiSteps(FULL))).toBe(true);
  });
});
