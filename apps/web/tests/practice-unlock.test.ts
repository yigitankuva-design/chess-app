import { describe, it, expect } from 'vitest';
import {
  UNLOCK_THRESHOLD, bestScore, isSubtopicUnlocked, isModeUnlocked,
  unlockedLabel, thresholdFor,
} from '@/lib/practice/unlock';
import type { ScoreMap, ThresholdMap } from '@/lib/practice/unlock';

const STEPS = [10, 20, 30]; // sıralı alt konu (lesson_step) id'leri

describe('bestScore', () => {
  it('kayıt yoksa 0 döner', () => expect(bestScore({}, 10, 'suresiz')).toBe(0));
  it('kayıt varsa değeri döner', () => expect(bestScore({ 10: { suresiz: 72 } }, 10, 'suresiz')).toBe(72));
  it('başka mod sorulursa 0 döner', () => expect(bestScore({ 10: { suresiz: 72 } }, 10, 'sureli')).toBe(0));
});

describe('isSubtopicUnlocked', () => {
  it('ilk alt konu her zaman açık', () => expect(isSubtopicUnlocked(STEPS, 10, {})).toBe(true));
  it('ikinci alt konu, birincinin testi 85 altındaysa kilitli', () => {
    expect(isSubtopicUnlocked(STEPS, 20, { 10: { test: 84 } })).toBe(false);
  });
  it('ikinci alt konu, birincinin testi tam 85 ise açık', () => {
    expect(isSubtopicUnlocked(STEPS, 20, { 10: { test: 85 } })).toBe(true);
  });
  it('üçüncü alt konu, ikinci bitmediyse kilitli (atlama yok)', () => {
    expect(isSubtopicUnlocked(STEPS, 30, { 10: { test: 100 } })).toBe(false);
  });
  it('listede olmayan step açık sayılır (bozuk veri kilitlemez)', () => {
    expect(isSubtopicUnlocked(STEPS, 99, {})).toBe(true);
  });

  it('hoca birinci alt konunun testi için özel puan girdiyse 85 yerine O kullanılır', () => {
    const thresholds: ThresholdMap = { 10: { test: 90 } };
    // 85 eskiden yeterliydi, hoca 90 istediyse artık yetmez.
    expect(isSubtopicUnlocked(STEPS, 20, { 10: { test: 85 } }, thresholds)).toBe(false);
    expect(isSubtopicUnlocked(STEPS, 20, { 10: { test: 90 } }, thresholds)).toBe(true);
  });
});

describe('isModeUnlocked', () => {
  it('açık alt konuda suresiz her zaman açık', () => {
    expect(isModeUnlocked(STEPS, 10, 'suresiz', {})).toBe(true);
  });
  it('sureli, suresiz 84 iken kilitli', () => {
    expect(isModeUnlocked(STEPS, 10, 'sureli', { 10: { suresiz: 84 } })).toBe(false);
  });
  it('sureli, suresiz 85 iken açık', () => {
    expect(isModeUnlocked(STEPS, 10, 'sureli', { 10: { suresiz: 85 } })).toBe(true);
  });
  it('test, sureli 85 iken açık', () => {
    expect(isModeUnlocked(STEPS, 10, 'test', { 10: { suresiz: 90, sureli: 85 } })).toBe(true);
  });
  it('test, sureli 40 iken kilitli', () => {
    expect(isModeUnlocked(STEPS, 10, 'test', { 10: { suresiz: 90, sureli: 40 } })).toBe(false);
  });
  it('KİLİTLİ ALT KONUDA hiçbir mod açılmaz', () => {
    const scores: ScoreMap = { 20: { suresiz: 100 } }; // 20 kilitli ama skoru var
    expect(isModeUnlocked(STEPS, 20, 'suresiz', scores)).toBe(false);
    expect(isModeUnlocked(STEPS, 20, 'sureli', scores)).toBe(false);
  });

  it('hoca suresiz için 70 girdiyse 70+ ile sureli açılır (85 beklenmez)', () => {
    const thresholds: ThresholdMap = { 10: { suresiz: 70 } };
    expect(isModeUnlocked(STEPS, 10, 'sureli', { 10: { suresiz: 70 } }, thresholds)).toBe(true);
    expect(isModeUnlocked(STEPS, 10, 'sureli', { 10: { suresiz: 69 } }, thresholds)).toBe(false);
  });

  it('hoca test için 95 girdiyse eski 85 artık yetmez', () => {
    const thresholds: ThresholdMap = { 10: { sureli: 95 } };
    expect(isModeUnlocked(STEPS, 10, 'test', { 10: { suresiz: 90, sureli: 85 } }, thresholds)).toBe(false);
    expect(isModeUnlocked(STEPS, 10, 'test', { 10: { suresiz: 90, sureli: 95 } }, thresholds)).toBe(true);
  });

  it('özel puan girilmemiş mod eskisi gibi 85 kullanır', () => {
    const thresholds: ThresholdMap = { 99: { suresiz: 50 } }; // başka bir stepId için
    expect(isModeUnlocked(STEPS, 10, 'sureli', { 10: { suresiz: 84 } }, thresholds)).toBe(false);
    expect(isModeUnlocked(STEPS, 10, 'sureli', { 10: { suresiz: 85 } }, thresholds)).toBe(true);
  });
});

describe('thresholdFor', () => {
  it('eşik girilmemişse UNLOCK_THRESHOLD (85) döner', () => {
    expect(thresholdFor(undefined, 10, 'suresiz')).toBe(85);
    expect(thresholdFor({}, 10, 'suresiz')).toBe(85);
    expect(thresholdFor({ 10: {} }, 10, 'suresiz')).toBe(85);
  });

  it('eşik girilmişse o değeri döner', () => {
    expect(thresholdFor({ 10: { suresiz: 60 } }, 10, 'suresiz')).toBe(60);
  });
});

describe('unlockedLabel', () => {
  it('suresiz 85+ → Süreli Pratik açılır', () => expect(unlockedLabel('suresiz')).toBe('Süreli Pratik'));
  it('sureli 85+ → Kendini Test Et açılır', () => expect(unlockedLabel('sureli')).toBe('Kendini Test Et'));
  it('test 85+ → sonraki alt konu açılır', () => expect(unlockedLabel('test')).toBe('Sonraki alt konu'));
});

describe('UNLOCK_THRESHOLD', () => {
  it('85tir', () => expect(UNLOCK_THRESHOLD).toBe(85));
});
