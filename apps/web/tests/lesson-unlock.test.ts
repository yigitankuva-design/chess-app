import { describe, it, expect } from 'vitest';
import { isLessonCompleted, isLessonUnlocked, UNLOCK_THRESHOLD } from '@/lib/practice/unlock';
import type { ScoreMap, ThresholdMap } from '@/lib/practice/unlock';

describe('isLessonCompleted (madde 10)', () => {
  it('son alt konuda test 85+ ise ders bitmiştir', () => {
    const scores: ScoreMap = { 10: { test: 90 }, 11: { test: 88 } };
    expect(isLessonCompleted([10, 11], scores)).toBe(true);
  });

  it('son alt konu eşiğin altındaysa ders bitmemiştir', () => {
    const scores: ScoreMap = { 10: { test: 100 }, 11: { test: UNLOCK_THRESHOLD - 1 } };
    expect(isLessonCompleted([10, 11], scores)).toBe(false);
  });

  it('hiç oynanmamışsa bitmemiştir', () => {
    expect(isLessonCompleted([10, 11], {})).toBe(false);
  });

  it('skorlar HENÜZ GELMEDİYSE bitmemiş sayılır (çağıran kilit uygulamaz)', () => {
    expect(isLessonCompleted([10], undefined)).toBe(false);
  });

  it('KURAL #3: alt konusu olmayan ders yolu tıkamaz — bitmiş sayılır', () => {
    expect(isLessonCompleted([], {})).toBe(true);
  });

  it('hoca özel başarı puanı girdiyse 85 yerine O puan kullanılır', () => {
    const scores: ScoreMap = { 10: { test: 90 } };
    const thresholds: ThresholdMap = { 10: { test: 95 } };
    // 90, hoca'nın istediği 95'in altında — hâlâ bitmemiş sayılır.
    expect(isLessonCompleted([10], scores, thresholds)).toBe(false);
    expect(isLessonCompleted([10], { 10: { test: 95 } }, thresholds)).toBe(true);
  });

  it('özel puan girilmemiş alt konu eskisi gibi 85 kullanır', () => {
    const scores: ScoreMap = { 10: { test: 85 } };
    const thresholds: ThresholdMap = { 10: { test: 95 } }; // farklı bir stepId için
    expect(isLessonCompleted([20], { 20: { test: 85 } }, thresholds)).toBe(true);
  });
});

describe('isLessonUnlocked (madde 10)', () => {
  const dersler = [1, 2, 3];

  it('ilk ders her zaman açıktır', () => {
    expect(isLessonUnlocked(dersler, 1, {})).toBe(true);
  });

  it('önceki ders bitmediyse KİLİTLİDİR', () => {
    expect(isLessonUnlocked(dersler, 2, { 1: false })).toBe(false);
  });

  it('önceki ders bittiyse açılır', () => {
    expect(isLessonUnlocked(dersler, 2, { 1: true })).toBe(true);
  });

  it('TUZAK: 2. ders bitse bile 1. bitmediyse 3. ders kilitli DEĞİL — kural yalnız BİR ÖNCEKİNE bakar', () => {
    // Zincir zaten 2'yi acmak icin 1'i zorunlu kilar; burada kuralin
    // kapsamini net tutuyoruz.
    expect(isLessonUnlocked(dersler, 3, { 1: false, 2: true })).toBe(true);
  });

  it('önceki dersin durumu bilinmiyorsa erişim kesilmez', () => {
    expect(isLessonUnlocked(dersler, 2, {})).toBe(true);
    expect(isLessonUnlocked(dersler, 2, { 1: undefined })).toBe(true);
  });

  it('listede olmayan ders kilitlenmez', () => {
    expect(isLessonUnlocked(dersler, 99, { 1: false })).toBe(true);
  });
});
