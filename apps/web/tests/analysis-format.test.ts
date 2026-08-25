import { describe, it, expect } from 'vitest';
import { pvUciToSan, formatContinuation, scoreForWhite, toTurkishSan } from '@/lib/chess/analysisFormat';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('pvUciToSan', () => {
  it('UCI hamle dizisini SAN dizisine çevirir', () => {
    expect(pvUciToSan(START_FEN, ['e2e4', 'e7e5', 'g1f3'])).toEqual(['e4', 'e5', 'Nf3']);
  });

  it('geçersiz hamlede orada durur, o ana kadarki kısmı döner', () => {
    expect(pvUciToSan(START_FEN, ['e2e4', 'zzzz', 'g1f3'])).toEqual(['e4']);
  });

  it('geçersiz FEN için boş dizi döner', () => {
    expect(pvUciToSan('saçma fen', ['e2e4'])).toEqual([]);
  });

  it('boş pv için boş dizi döner', () => {
    expect(pvUciToSan(START_FEN, [])).toEqual([]);
  });
});

describe('formatContinuation', () => {
  it('beyaz sıradayken hamle numarasıyla başlar (madde 2026-08-31 (2): Türkçe notasyon)', () => {
    expect(formatContinuation(START_FEN, ['e4', 'e5', 'Nf3'])).toBe('1. e4 e5 2. Af3');
  });

  it('siyah sıradayken "..." ile başlar (Türkçe notasyon)', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(formatContinuation(fen, ['Nc6', 'Bc4', 'Nf6'])).toBe('1... Ac6 2. Fc4 Af6');
  });

  it('FEN\'deki mevcut hamle numarasından devam eder (Türkçe notasyon)', () => {
    const fen = '8/8/8/4k3/8/8/4P3/4K3 w - - 0 5';
    expect(formatContinuation(fen, ['e4', 'Kd5'])).toBe('5. e4 Şd5');
  });

  it('boş SAN dizisi için boş metin döner', () => {
    expect(formatContinuation(START_FEN, [])).toBe('');
  });
});

describe('toTurkishSan (madde 2026-08-31/2)', () => {
  it('piyon hamlesi değişmez', () => {
    expect(toTurkishSan('e4')).toBe('e4');
    expect(toTurkishSan('exd5')).toBe('exd5');
  });

  it('taş harflerini Türkçe karşılığına çevirir: Ş/V/K/F/A', () => {
    expect(toTurkishSan('Kd5')).toBe('Şd5');
    expect(toTurkishSan('Qh4')).toBe('Vh4');
    expect(toTurkishSan('Rd1')).toBe('Kd1');
    expect(toTurkishSan('Bc4')).toBe('Fc4');
    expect(toTurkishSan('Nf3')).toBe('Af3');
  });

  it('al/şah/mat işaretleri ve kare adı değişmez', () => {
    expect(toTurkishSan('Nxe5')).toBe('Axe5');
    expect(toTurkishSan('Qh4#')).toBe('Vh4#');
    expect(toTurkishSan('Nbd2')).toBe('Abd2');
  });

  it('terfi harfini çevirir', () => {
    expect(toTurkishSan('e8=Q')).toBe('e8=V');
    expect(toTurkishSan('e8=Q+')).toBe('e8=V+');
  });

  it('rok notasyonu değişmez', () => {
    expect(toTurkishSan('O-O')).toBe('O-O');
    expect(toTurkishSan('O-O-O')).toBe('O-O-O');
  });

  it('boş metin için boş döner', () => {
    expect(toTurkishSan('')).toBe('');
  });
});

describe('scoreForWhite', () => {
  it('beyaz sıradaysa skor DEĞİŞMEZ', () => {
    expect(scoreForWhite(50, null, 'w')).toEqual({ cp: 50, mate: null });
  });

  it('siyah sıradaysa skor TERSİNE çevrilir', () => {
    expect(scoreForWhite(50, null, 'b')).toEqual({ cp: -50, mate: null });
  });

  it('mat skoru da aynı mantıkla çevrilir', () => {
    expect(scoreForWhite(null, 3, 'b')).toEqual({ cp: null, mate: -3 });
  });

  it('null skor null kalır', () => {
    expect(scoreForWhite(null, null, 'w')).toEqual({ cp: null, mate: null });
  });
});
