import { describe, it, expect } from 'vitest';
import { mergeSettings, DEFAULT_SETTINGS, visibleTabsInOrder } from '@/lib/settings/defaults';

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
    expect(merged.labels.features.analiz).toBe(DEFAULT_SETTINGS.labels.features.analiz);
    // diğer üst alanlar korunur
    expect(merged.board.lightSquare).toBe(DEFAULT_SETTINGS.board.lightSquare);
    expect(merged.tabs.play).toBe(true);
  });

  it('tahta renklerini ve sekmeleri override eder', () => {
    const merged = mergeSettings({ board: { darkSquare: '#000000' }, tabs: { analiz: false } });
    expect(merged.board.darkSquare).toBe('#000000');
    expect(merged.board.lightSquare).toBe(DEFAULT_SETTINGS.board.lightSquare);
    expect(merged.tabs.analiz).toBe(false);
    expect(merged.tabs.play).toBe(true);
  });
});

describe('visibleTabsInOrder', () => {
  it('varsayılanda 4 sekmeyi doğru sırayla verir', () => {
    expect(visibleTabsInOrder(DEFAULT_SETTINGS)).toEqual(['play', 'lessons', 'analiz', 'eglence']);
  });

  it('admin sırasını uygular', () => {
    const s = mergeSettings({ tabOrder: ['eglence', 'play', 'lessons', 'analiz'] });
    expect(visibleTabsInOrder(s)).toEqual(['eglence', 'play', 'lessons', 'analiz']);
  });

  it('kaldırılan (false) sekmeyi göstermez', () => {
    const s = mergeSettings({ tabs: { analiz: false } });
    expect(visibleTabsInOrder(s)).toEqual(['play', 'lessons', 'eglence']);
  });

  it('bozuk/eksik sırada sekme kaybetmez — bilinmeyeni atar, eksiği sona ekler', () => {
    const s = mergeSettings({ tabOrder: ['eglence', 'BOZUK'] });
    expect(visibleTabsInOrder(s)).toEqual(['eglence', 'play', 'lessons', 'analiz']);
  });

  it('tabOrder hiç yoksa varsayılan sıraya döner', () => {
    const s = mergeSettings({ tabOrder: 'bozuk-veri' });
    expect(visibleTabsInOrder(s)).toEqual(['play', 'lessons', 'analiz', 'eglence']);
  });
});
