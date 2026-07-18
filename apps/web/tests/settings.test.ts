import { describe, it, expect } from 'vitest';
import { mergeSettings, DEFAULT_SETTINGS } from '@/lib/settings/defaults';

describe('mergeSettings', () => {
  it('boş remote için varsayılanları döndürür', () => {
    expect(mergeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('null/geçersiz remote için varsayılanları döndürür', () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings('bozuk')).toEqual(DEFAULT_SETTINGS);
  });

  it('sadece verilen alanı override eder, gerisini korur', () => {
    const merged = mergeSettings({ labels: { features: { play: 'Oynayalım' } } });
    expect(merged.labels.features.play).toBe('Oynayalım');
    // diğer feature'lar varsayılan kalır
    expect(merged.labels.features.puzzle).toBe(DEFAULT_SETTINGS.labels.features.puzzle);
    // diğer üst alanlar korunur
    expect(merged.board.lightSquare).toBe(DEFAULT_SETTINGS.board.lightSquare);
    expect(merged.tabs.play).toBe(true);
  });

  it('tahta renklerini ve sekmeleri override eder', () => {
    const merged = mergeSettings({ board: { darkSquare: '#000000' }, tabs: { puzzle: false } });
    expect(merged.board.darkSquare).toBe('#000000');
    expect(merged.board.lightSquare).toBe(DEFAULT_SETTINGS.board.lightSquare);
    expect(merged.tabs.puzzle).toBe(false);
    expect(merged.tabs.play).toBe(true);
  });
});
