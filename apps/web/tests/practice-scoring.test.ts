import { describe, it, expect } from 'vitest';
import { scorePercent, thresholdMessage } from '@/lib/practice/scoring';

describe('scorePercent', () => {
  it('20 soruda 20 doğru = 100', () => expect(scorePercent(20, 20)).toBe(100));
  it('20 soruda 17 doğru = 85', () => expect(scorePercent(17, 20)).toBe(85));
  it('20 soruda 0 doğru = 0', () => expect(scorePercent(0, 20)).toBe(0));
  it('yuvarlama: 7/9 = 78', () => expect(scorePercent(7, 9)).toBe(78));
  it('total 0 ise 0 döner (sıfıra bölme koruması)', () => expect(scorePercent(0, 0)).toBe(0));
  it('total negatifse 0 döner', () => expect(scorePercent(5, -1)).toBe(0));
  it('correct total u aşarsa 100 ile sınırlanır', () => expect(scorePercent(30, 20)).toBe(100));
});

describe('thresholdMessage', () => {
  it('49 → daha fazla pratik', () => expect(thresholdMessage(49)).toBe('Çok Daha Fazla Pratik Yapmalısın'));
  it('0 → daha fazla pratik', () => expect(thresholdMessage(0)).toBe('Çok Daha Fazla Pratik Yapmalısın'));
  it('50 → iyi gidiyorsun (alt sınır dahil)', () => expect(thresholdMessage(50)).toBe('İyi Gidiyorsun'));
  it('80 → iyi gidiyorsun (üst sınır dahil)', () => expect(thresholdMessage(80)).toBe('İyi Gidiyorsun'));
  it('81 → tebrikler', () => expect(thresholdMessage(81)).toBe('Tebrikler'));
  it('85 → tebrikler', () => expect(thresholdMessage(85)).toBe('Tebrikler'));
  it('100 → tebrikler', () => expect(thresholdMessage(100)).toBe('Tebrikler'));
});
