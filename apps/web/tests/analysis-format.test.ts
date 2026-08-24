import { describe, it, expect } from 'vitest';
import { pvUciToSan, formatContinuation, scoreForWhite } from '@/lib/chess/analysisFormat';

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
  it('beyaz sıradayken hamle numarasıyla başlar', () => {
    expect(formatContinuation(START_FEN, ['e4', 'e5', 'Nf3'])).toBe('1. e4 e5 2. Nf3');
  });

  it('siyah sıradayken "..." ile başlar', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    expect(formatContinuation(fen, ['Nc6', 'Bc4', 'Nf6'])).toBe('1... Nc6 2. Bc4 Nf6');
  });

  it('FEN\'deki mevcut hamle numarasından devam eder', () => {
    const fen = '8/8/8/4k3/8/8/4P3/4K3 w - - 0 5';
    expect(formatContinuation(fen, ['e4', 'Kd5'])).toBe('5. e4 Kd5');
  });

  it('boş SAN dizisi için boş metin döner', () => {
    expect(formatContinuation(START_FEN, [])).toBe('');
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
