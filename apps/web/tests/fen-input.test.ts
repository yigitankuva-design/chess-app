import { describe, it, expect } from 'vitest';
import { parseFenInput } from '@/lib/chess/fenInput';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const SIYAH_SIRASI = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

describe('parseFenInput', () => {
  it('geçerli FEN kabul edilir, hamle sırası beyaz okunur', () => {
    const r = parseFenInput(START);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.turn).toBe('w');
      expect(r.fen).toBe(START);
    }
  });

  it('siyah sırasındaki FEN doğru okunur', () => {
    const r = parseFenInput(SIYAH_SIRASI);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.turn).toBe('b');
  });

  it('baştaki/sondaki boşluklar temizlenir', () => {
    const r = parseFenInput(`   ${START}   `);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fen).toBe(START);
  });

  it('boş metin reddedilir', () => {
    expect(parseFenInput('').ok).toBe(false);
    expect(parseFenInput('    ').ok).toBe(false);
  });

  it('anlamsız metin reddedilir', () => {
    expect(parseFenInput('merhaba dünya').ok).toBe(false);
  });

  it('bozuk FEN reddedilir', () => {
    // 9 kare iddiası olan bozuk satır
    expect(parseFenInput('rnbqkbnr/ppppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1').ok).toBe(false);
  });

  it('şahsız konum reddedilir (oyun kurulamaz)', () => {
    expect(parseFenInput('8/8/8/8/8/8/8/8 w - - 0 1').ok).toBe(false);
  });
});

describe('withTurn', () => {
  it('hamle sırasını FEN içinde değiştirir', async () => {
    const { withTurn } = await import('@/lib/chess/fenInput');
    expect(withTurn(START, 'b')).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1');
  });

  it('aynı sıra verilirse FEN değişmez', async () => {
    const { withTurn } = await import('@/lib/chess/fenInput');
    expect(withTurn(START, 'w')).toBe(START);
  });

  it('siyahtan beyaza çevirir', async () => {
    const { withTurn } = await import('@/lib/chess/fenInput');
    expect(withTurn(SIYAH_SIRASI, 'w')).toContain(' w ');
  });
});
