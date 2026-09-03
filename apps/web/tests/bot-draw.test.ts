import { describe, it, expect } from 'vitest';
import { materialDiff, botAcceptsDraw, DRAW_ACCEPT_MARGIN_PAWNS } from '@/lib/play/botDraw';

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

describe('botAcceptsDraw (madde 2026-09-03 (2): motor puanına göre ±3)', () => {
  it('eşit pozisyonda (0 puan) kabul eder', () => {
    expect(botAcceptsDraw(0)).toBe(true);
  });

  it('sporcu tam sınırda (+3 / -3) hâlâ kabul edilir', () => {
    expect(botAcceptsDraw(3)).toBe(true);
    expect(botAcceptsDraw(-3)).toBe(true);
  });

  it('sporcu +3\'ten FAZLA öndeyse (hangi yönde olursa olsun) REDDEDER', () => {
    expect(botAcceptsDraw(3.01)).toBe(false);
    expect(botAcceptsDraw(-3.01)).toBe(false);
  });

  it('sporcu açık ara öndeyse de REDDEDER (kolay beraberlik yok)', () => {
    expect(botAcceptsDraw(9)).toBe(false);
  });

  it('sporcu açık ara GERİDEyse de REDDEDER (madde: hangi taraf lehine olursa olsun)', () => {
    expect(botAcceptsDraw(-9)).toBe(false);
  });

  it('eşik sabiti 3 puan', () => {
    expect(DRAW_ACCEPT_MARGIN_PAWNS).toBe(3);
  });
});
