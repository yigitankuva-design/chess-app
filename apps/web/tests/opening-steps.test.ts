import { describe, it, expect } from 'vitest';
import {
  isCriteriaUnlocked, isOpeningUnlocked, isVariantUnlocked,
  openingSummary, categorySummary, variantSummary,
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
    expect(categorySummary('d4')).toBe("✓ d4'lü Açılışlar");
  });
});

describe('isVariantUnlocked (madde: 2026-08-20)', () => {
  it('açılış ismi seçilmediyse kilitlidir', () => {
    expect(isVariantUnlocked(null)).toBe(false);
  });

  it('açılış ismi seçildiyse açılabilir', () => {
    expect(isVariantUnlocked('İtalyan Açılışı')).toBe(true);
  });

  it('boş ad seçim sayılmaz', () => {
    expect(isVariantUnlocked('')).toBe(false);
    expect(isVariantUnlocked('   ')).toBe(false);
  });
});

describe('isCriteriaUnlocked', () => {
  it('varyant seçilmediyse kilitlidir', () => {
    expect(isCriteriaUnlocked(null)).toBe(false);
  });

  it('varyant seçildiyse açılabilir', () => {
    expect(isCriteriaUnlocked('Klasik Varyant')).toBe(true);
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

describe('variantSummary (madde: 2026-08-20)', () => {
  it('seçim yoksa null döner', () => {
    expect(variantSummary(null)).toBeNull();
    expect(variantSummary('  ')).toBeNull();
  });

  it('seçim varsa tik işaretli özet döner', () => {
    expect(variantSummary('Klasik Varyant')).toBe('✓ Klasik Varyant');
  });
});
