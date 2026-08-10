import { describe, it, expect } from 'vitest';
import {
  isCriteriaUnlocked, isOpeningUnlocked, openingSummary, categorySummary,
} from '@/lib/play/openingSteps';

describe('isOpeningUnlocked', () => {
  it('tür seçilmediyse kilitlidir', () => {
    expect(isOpeningUnlocked(null)).toBe(false);
  });

  it('tür seçildiyse açılabilir', () => {
    expect(isOpeningUnlocked('e4')).toBe(true);
    expect(isOpeningUnlocked('diger')).toBe(true);
  });
});

describe('categorySummary', () => {
  it('seçim yoksa null döner', () => {
    expect(categorySummary(null)).toBeNull();
  });

  it('seçim varsa tik işaretli tür adı döner', () => {
    expect(categorySummary('d4')).toBe('✓ d4 ile Başlayanlar');
  });
});

describe('isCriteriaUnlocked', () => {
  it('açılış seçilmediyse kilitlidir', () => {
    expect(isCriteriaUnlocked(null)).toBe(false);
  });

  it('açılış seçildiyse açılabilir', () => {
    expect(isCriteriaUnlocked('İtalyan Açılışı')).toBe(true);
  });

  it('boş ad seçim sayılmaz', () => {
    expect(isCriteriaUnlocked('')).toBe(false);
    expect(isCriteriaUnlocked('   ')).toBe(false);
  });
});

describe('openingSummary', () => {
  it('seçim yoksa null döner', () => {
    expect(openingSummary(null)).toBeNull();
    expect(openingSummary('  ')).toBeNull();
  });

  it('seçim varsa tik işaretli özet döner', () => {
    expect(openingSummary('İtalyan Açılışı')).toBe('✓ İtalyan Açılışı');
  });

  it('baştaki/sondaki boşlukları kırpar', () => {
    expect(openingSummary('  Sicilya Savunması  ')).toBe('✓ Sicilya Savunması');
  });
});
