import { describe, it, expect } from 'vitest';
import { formatGameResult, GAME_RESULT_TEXT } from '@/lib/play/resultText';

describe('GAME_RESULT_TEXT', () => {
  it('üç sonuç için kullanıcının istediği tam metinler', () => {
    expect(GAME_RESULT_TEXT['1-0']).toBe('1 – 0 (Beyaz Kazandı)');
    expect(GAME_RESULT_TEXT['0-1']).toBe('0 – 1 (Siyah Kazandı)');
    expect(GAME_RESULT_TEXT['1/2-1/2']).toBe('1/2 – 1/2 (Beraberlik)');
  });
});

describe('formatGameResult', () => {
  it('beyaz kazandı', () => {
    expect(formatGameResult('1-0')).toBe('1 – 0 (Beyaz Kazandı)');
  });

  it('siyah kazandı', () => {
    expect(formatGameResult('0-1')).toBe('0 – 1 (Siyah Kazandı)');
  });

  it('beraberlik', () => {
    expect(formatGameResult('1/2-1/2')).toBe('1/2 – 1/2 (Beraberlik)');
  });

  it('bilinmeyen sonuç boş string döner (çökmez)', () => {
    expect(formatGameResult('garbage')).toBe('');
  });

  it('undefined sonuç boş string döner', () => {
    expect(formatGameResult(undefined)).toBe('');
  });
});
