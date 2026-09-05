import { describe, it, expect } from 'vitest';
import { resultHeadline } from '@/lib/practice/resultHeadline';

describe('resultHeadline (madde 7)', () => {
  it('Süresiz — 85 altı: kırmızı, tekrar Ödevini Yap uyarısı (madde 2026-09-05: yeniden adlandırma)', () => {
    expect(resultHeadline('suresiz', 84)).toEqual({
      text: 'Üzgünüm Yeniden Ödevini Yapmalısın', tone: 'retry',
    });
  });

  it('Süresiz — 85 ve üzeri: yeşil, Süreli Pratik müjdesi', () => {
    expect(resultHeadline('suresiz', 85)).toEqual({
      text: 'Tebrikler Süreli Pratik Yapabilirsin', tone: 'success',
    });
  });

  it('Süreli — 85 altı: kırmızı, tekrar Süreli Pratik uyarısı', () => {
    expect(resultHeadline('sureli', 0)).toEqual({
      text: 'Üzgünüm Yeniden Süreli Pratik Yapmalısın', tone: 'retry',
    });
  });

  it('Süreli — 85 ve üzeri: yeşil, Kendini Test Et müjdesi', () => {
    expect(resultHeadline('sureli', 100)).toEqual({
      text: 'Tebrikler Kendini Test Et Yapabilirsin', tone: 'success',
    });
  });

  it('Test — 85 altı: kırmızı, tekrar Kendini Test Et uyarısı', () => {
    expect(resultHeadline('test', 50)).toEqual({
      text: 'Üzgünüm Yeniden Kendini Test Et Yapmalısın', tone: 'retry',
    });
  });

  it('Test — 85 ve üzeri: sonraki alt konu için özel tamamlama metni', () => {
    expect(resultHeadline('test', 90)).toEqual({
      text: 'Tebrikler! Bu Konuyu Tamamladın', tone: 'success',
    });
  });

  it('sınır: tam 85 puan BAŞARILI sayılır', () => {
    expect(resultHeadline('suresiz', 85).tone).toBe('success');
    expect(resultHeadline('suresiz', 84).tone).toBe('retry');
  });

  it('hoca özel eşik verdiyse (3. parametre) 85 yerine O kullanılır', () => {
    expect(resultHeadline('suresiz', 70, 70).tone).toBe('success');
    expect(resultHeadline('suresiz', 69, 70).tone).toBe('retry');
    // Eskiden 85 yeterliydi ama hoca 90 istediyse artık yetmez.
    expect(resultHeadline('sureli', 85, 90).tone).toBe('retry');
  });

  it('3. parametre verilmezse eskisi gibi 85 kullanılır', () => {
    expect(resultHeadline('suresiz', 85).tone).toBe('success');
  });
});
