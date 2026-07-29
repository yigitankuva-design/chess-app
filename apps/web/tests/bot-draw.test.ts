import { describe, it, expect } from 'vitest';
import { materialDiff, botAcceptsDraw } from '@/lib/play/botDraw';

const BASLANGIC = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Beyazin fazla bir veziri var (siyahin veziri yok).
const BEYAZ_ONDE = 'rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Siyahin fazla bir kalesi var (beyazin a1 kalesi yok).
const SIYAH_ONDE = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w KQkq - 0 1';

describe('materialDiff', () => {
  it('başlangıç konumunda fark yoktur', () => {
    expect(materialDiff(BASLANGIC)).toBe(0);
  });

  it('eksik siyah vezir beyaz lehine 9 yapar', () => {
    expect(materialDiff(BEYAZ_ONDE)).toBe(9);
  });

  it('eksik beyaz kale siyah lehine 5 yapar', () => {
    expect(materialDiff(SIYAH_ONDE)).toBe(-5);
  });

  it('yalnızca taş dizilimi okunur — sıra/rok bilgisi sayılmaz', () => {
    // "b KQkq" icindeki b ve K harfleri tas sanilirsa sonuc bozulur.
    expect(materialDiff(BASLANGIC.replace(' w ', ' b '))).toBe(0);
  });
});

describe('botAcceptsDraw (madde 6)', () => {
  it('eşit konumda kabul eder', () => {
    expect(botAcceptsDraw(BASLANGIC, 'b')).toBe(true);
    expect(botAcceptsDraw(BASLANGIC, 'w')).toBe(true);
  });

  it('bot açık ara öndeyse REDDEDER', () => {
    expect(botAcceptsDraw(BEYAZ_ONDE, 'w')).toBe(false);
  });

  it('bot geride ise kabul eder', () => {
    expect(botAcceptsDraw(BEYAZ_ONDE, 'b')).toBe(true);
  });

  it('bir piyonluk üstünlük reddetmeye yetmez', () => {
    // Siyahin bir piyonu eksik; bot beyaz ve 1 onde.
    const birPiyonFazla = 'rnbqkbnr/ppppppp1/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(materialDiff(birPiyonFazla)).toBe(1);
    expect(botAcceptsDraw(birPiyonFazla, 'w')).toBe(true);
  });
});
