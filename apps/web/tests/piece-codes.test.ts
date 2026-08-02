import { describe, it, expect } from 'vitest';
import { PIECE_PALETTE, pieceKey, pieceTypeToFen, isPieceCode, pieceLabel } from '@/lib/chess/pieceCodes';

describe('pieceCodes', () => {
  it('palette 12 taş içerir', () => {
    expect(PIECE_PALETTE).toHaveLength(12);
    expect(PIECE_PALETTE.map((p) => p.code)).toContain('K');
    expect(PIECE_PALETTE.map((p) => p.code)).toContain('p');
  });

  it('FEN harfini taş seti anahtarına çevirir', () => {
    expect(pieceKey('K')).toBe('wK');
    expect(pieceKey('p')).toBe('bP');
    expect(pieceKey('n')).toBe('bN');
  });

  it('taş seti anahtarını FEN harfine çevirir', () => {
    expect(pieceTypeToFen('wK')).toBe('K');
    expect(pieceTypeToFen('bP')).toBe('p');
  });

  it('iki çevrim birbirinin tersidir', () => {
    for (const { code } of PIECE_PALETTE) {
      expect(pieceTypeToFen(pieceKey(code))).toBe(code);
    }
  });

  it('geçerli taş kodunu tanır', () => {
    expect(isPieceCode('Q')).toBe(true);
    expect(isPieceCode('q')).toBe(true);
    expect(isPieceCode('X')).toBe(false);
    // TUZAK: '' bir alt dizedir — uzunluk kontrolü olmadan true dönerdi.
    expect(isPieceCode('')).toBe(false);
    expect(isPieceCode('QQ')).toBe(false);
  });

  it('taşın Türkçe adını verir', () => {
    expect(pieceLabel('Q')).toBe('Beyaz Vezir');
    expect(pieceLabel('n')).toBe('Siyah At');
    expect(pieceLabel('X')).toBe('X');
  });
});
