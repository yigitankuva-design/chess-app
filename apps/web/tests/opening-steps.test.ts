import { describe, it, expect } from 'vitest';
import { isCriteriaUnlocked, variantSummary } from '@/lib/play/openingSteps';

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

describe('variantSummary (madde: 2026-08-20)', () => {
  it('seçim yoksa null döner', () => {
    expect(variantSummary(null)).toBeNull();
    expect(variantSummary('  ')).toBeNull();
  });

  it('seçim varsa tik işaretli özet döner', () => {
    expect(variantSummary('Klasik Varyant')).toBe('✓ Klasik Varyant');
  });

  it('baştaki/sondaki boşlukları kırpar', () => {
    expect(variantSummary('  Sicilya Savunması  ')).toBe('✓ Sicilya Savunması');
  });
});
