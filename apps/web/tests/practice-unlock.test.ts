import { describe, it, expect } from 'vitest';
import {
  UNLOCK_THRESHOLD, bestScore, isSubtopicUnlocked, isModeUnlocked, unlockedLabel,
} from '@/lib/practice/unlock';
import type { ScoreMap } from '@/lib/practice/unlock';

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
});

describe('unlockedLabel', () => {
  it('suresiz 85+ → Süreli Pratik açılır', () => expect(unlockedLabel('suresiz')).toBe('Süreli Pratik'));
  it('sureli 85+ → Kendini Test Et açılır', () => expect(unlockedLabel('sureli')).toBe('Kendini Test Et'));
  it('test 85+ → sonraki alt konu açılır', () => expect(unlockedLabel('test')).toBe('Sonraki alt konu'));
});

describe('UNLOCK_THRESHOLD', () => {
  it('85tir', () => expect(UNLOCK_THRESHOLD).toBe(85));
});
