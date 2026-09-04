import { describe, it, expect } from 'vitest';
import { konumPratigiSteps } from '@/lib/admin/konumPratigiSteps';
import { firstIncomplete, allDone } from '@/lib/admin/questionSteps';
import type { KonumPratigiStepState } from '@/lib/admin/konumPratigiSteps';

const BLANK: KonumPratigiStepState = {
  fenValid: false,
  optionCountChosen: false,
  answerKindChosen: false,
  options: [],
};

const FULL: KonumPratigiStepState = {
  fenValid: true,
  optionCountChosen: true,
  answerKindChosen: true,
  options: ['İtalyan Açılışı', 'İspanyol Açılışı'],
};

describe('konumPratigiSteps (madde 2026-09-06 üçüncü tur/2: "Talimatı Gir" kaldırıldı)', () => {
  it('beş adım döner, sıra numaraları 1-5 olur', () => {
    const steps = konumPratigiSteps(BLANK);
    expect(steps).toHaveLength(5);
    expect(steps.map((s) => s.no)).toEqual([1, 2, 3, 4, 5]);
  });

  it('adım etiketleri Zafer\'in belirttiği sırayla ("Talimatı Gir" YOK)', () => {
    expect(konumPratigiSteps(BLANK).map((s) => s.label)).toEqual([
      'FEN Ekle',
      'Seçenek Sayısını Belirle',
      'Cevap Tipini Belirle',
      'Cevapları Gir',
      'Soruyu Ekle',
    ]);
  });

  it('boş durumda hiçbir adım tamamlanmamıştır', () => {
    expect(konumPratigiSteps(BLANK).every((s) => !s.done)).toBe(true);
  });

  it('tam durumda beş adım da tamamlanmıştır', () => {
    expect(konumPratigiSteps(FULL).every((s) => s.done)).toBe(true);
  });

  it('adım 1 FEN geçerli olunca tamamlanır', () => {
    expect(konumPratigiSteps({ ...BLANK, fenValid: true })[0].done).toBe(true);
  });

  it('TUZAK: adım 2 seçenek sayısı BİLFİİL seçilmeden tamamlanmaz', () => {
    expect(konumPratigiSteps(BLANK)[1].done).toBe(false);
    expect(konumPratigiSteps({ ...BLANK, optionCountChosen: true })[1].done).toBe(true);
  });

  it('TUZAK: adım 3 cevap tipi BİLFİİL seçilmeden tamamlanmaz', () => {
    expect(konumPratigiSteps(BLANK)[2].done).toBe(false);
    expect(konumPratigiSteps({ ...BLANK, answerKindChosen: true })[2].done).toBe(true);
  });

  it('adım 4 en az iki dolu şık varsa tamamlanır', () => {
    expect(konumPratigiSteps({ ...BLANK, options: ['A', 'B'] })[3].done).toBe(true);
    expect(konumPratigiSteps({ ...BLANK, options: ['A', ''] })[3].done).toBe(false);
    expect(konumPratigiSteps({ ...BLANK, options: ['A'] })[3].done).toBe(false);
  });

  it('Soruyu Ekle (5) yalnızca öncekilerin hepsi bitince tamamlanır', () => {
    expect(konumPratigiSteps(FULL)[4].done).toBe(true);
    expect(konumPratigiSteps({ ...FULL, fenValid: false })[4].done).toBe(false);
  });
});

describe('konumPratigiSteps + firstIncomplete/allDone (questionSteps.ts, paylaşılan)', () => {
  it('boş durumda ilk eksik adım 1. adımdır', () => {
    expect(firstIncomplete(konumPratigiSteps(BLANK))?.no).toBe(1);
  });

  it('tam durumda eksik adım yoktur', () => {
    expect(firstIncomplete(konumPratigiSteps(FULL))).toBeNull();
  });

  it('allDone yalnızca hepsi tamamsa true döner', () => {
    expect(allDone(konumPratigiSteps(BLANK))).toBe(false);
    expect(allDone(konumPratigiSteps(FULL))).toBe(true);
  });
});
