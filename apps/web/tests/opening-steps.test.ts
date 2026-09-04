import { describe, it, expect } from 'vitest';
import { isColorUnlocked, isMoveLimitUnlocked, variantSummary, colorSummary } from '@/lib/play/openingSteps';

describe('isColorUnlocked', () => {
  it('varyant seçilmediyse kilitlidir', () => {
    expect(isColorUnlocked(null)).toBe(false);
  });

  it('varyant seçildiyse açılabilir', () => {
    expect(isColorUnlocked('Klasik Varyant')).toBe(true);
  });

  it('boş ad seçim sayılmaz', () => {
    expect(isColorUnlocked('')).toBe(false);
    expect(isColorUnlocked('   ')).toBe(false);
  });
});

describe('isMoveLimitUnlocked (madde 2026-09-06 üçüncü tur/4)', () => {
  it('renk seçilmediyse kilitlidir', () => {
    expect(isMoveLimitUnlocked(null)).toBe(false);
  });

  it('renk seçildiyse açılabilir', () => {
    expect(isMoveLimitUnlocked('white')).toBe(true);
    expect(isMoveLimitUnlocked('random')).toBe(true);
    expect(isMoveLimitUnlocked('black')).toBe(true);
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

describe('colorSummary (madde 2026-09-06 üçüncü tur/4)', () => {
  it('seçim yoksa null döner', () => {
    expect(colorSummary(null)).toBeNull();
  });

  it('seçim varsa Türkçe etiketle tik işaretli özet döner', () => {
    expect(colorSummary('white')).toBe('✓ Beyaz');
    expect(colorSummary('random')).toBe('✓ Rastgele');
    expect(colorSummary('black')).toBe('✓ Siyah');
  });
});
