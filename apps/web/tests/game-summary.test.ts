import { describe, it, expect } from 'vitest';
import {
  winPercent, moveAccuracyFromWinDrop, classifyDelta, gamePhase, computeGameSummary,
} from '@/lib/chess/gameSummary';
import type { WhiteScore } from '@/lib/chess/moveQuality';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Az taşlı, düşük malzemeli bir "oyunsonu" pozisyonu (sadece şahlar + birer piyon).
const ENDGAME_FEN = '8/8/4k3/4p3/4P3/4K3/8/8 w - - 0 1';
// Yüksek malzemeli bir "oyunortası" pozisyonu (vezirler + kaleler dahil taşlar duruyor).
const MIDDLEGAME_FEN = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1';

describe('winPercent', () => {
  it('eşit pozisyon (0 cp) → %50', () => {
    expect(winPercent(0)).toBeCloseTo(50, 5);
  });
  it('pozitif cp → %50\'nin üstü', () => {
    expect(winPercent(300)).toBeGreaterThan(50);
  });
  it('negatif cp → %50\'nin altı', () => {
    expect(winPercent(-300)).toBeLessThan(50);
  });
});

describe('moveAccuracyFromWinDrop', () => {
  it('düşüş yoksa doğruluk 100', () => {
    expect(moveAccuracyFromWinDrop(0)).toBeCloseTo(100, 0);
  });
  it('büyük düşüş doğruluğu düşürür, 0\'ın altına inmez', () => {
    const acc = moveAccuracyFromWinDrop(80);
    expect(acc).toBeLessThan(50);
    expect(acc).toBeGreaterThanOrEqual(0);
  });
});

describe('classifyDelta (madde: 50/100/300 cp eşikleri)', () => {
  it('49 cp altı sınıflandırılmaz', () => {
    expect(classifyDelta(49)).toBeNull();
  });
  it('50-99 cp → inaccuracy', () => {
    expect(classifyDelta(50)).toBe('inaccuracy');
    expect(classifyDelta(99)).toBe('inaccuracy');
  });
  it('100-299 cp → mistake', () => {
    expect(classifyDelta(100)).toBe('mistake');
    expect(classifyDelta(299)).toBe('mistake');
  });
  it('300+ cp → blunder', () => {
    expect(classifyDelta(300)).toBe('blunder');
    expect(classifyDelta(900)).toBe('blunder');
  });
});

describe('gamePhase (basit sezgisel kural)', () => {
  it('ilk 20 ply her zaman açılış sayılır (malzeme az olsa bile)', () => {
    expect(gamePhase(1, ENDGAME_FEN)).toBe('opening');
    expect(gamePhase(20, ENDGAME_FEN)).toBe('opening');
  });
  it('20 ply sonrası, malzeme düşükse oyunsonu', () => {
    expect(gamePhase(21, ENDGAME_FEN)).toBe('endgame');
  });
  it('20 ply sonrası, malzeme yüksekse oyunortası', () => {
    expect(gamePhase(21, MIDDLEGAME_FEN)).toBe('middlegame');
  });
});

describe('computeGameSummary', () => {
  it('sadece sporcunun hamleleri sayılır — beyaz sporcu', () => {
    const evalByPly: Record<number, WhiteScore> = {
      0: { cp: 0, mate: null },      // başlangıç
      1: { cp: -150, mate: null },   // beyazın (sporcu) hamlesinden sonra — kötüleşti
      2: { cp: 400, mate: null },    // siyahın (bot) hamlesi — sporcuyu İLGİLENDİRMEZ
    };
    const fens = [START, START, START];
    const summary = computeGameSummary(evalByPly, fens, 'w');
    expect(summary.mistakes).toBe(1);
    expect(summary.inaccuracies).toBe(0);
    expect(summary.blunders).toBe(0);
    expect(summary.acpl).toBe(150);
    expect(summary.accuracy).not.toBeNull();
  });

  it('sadece sporcunun hamleleri sayılır — siyah sporcu', () => {
    const evalByPly: Record<number, WhiteScore> = {
      0: { cp: 0, mate: null },
      1: { cp: -400, mate: null },   // beyazın (bot) hamlesi — sporcuyu (siyah) İLGİLENDİRMEZ
      2: { cp: -700, mate: null },   // siyahın (sporcu) hamlesinden sonra beyaz +700 → sporcu için kötü
    };
    const fens = [START, START, START];
    const summary = computeGameSummary(evalByPly, fens, 'b');
    // beforeForStudent (siyah acisindan, ply1 sonrasi) = -(-400) = 400
    // afterForStudent (ply2 sonrasi) = -(-700) = 700 → sporcu icin DAHA IYI (kayip yok)
    expect(summary.blunders + summary.mistakes + summary.inaccuracies).toBe(0);
  });

  it('eksik motor verisi (henüz değerlendirilmemiş ply) sessizce atlanır', () => {
    const evalByPly: Record<number, WhiteScore> = { 0: { cp: 0, mate: null } };
    const fens = [START, START];
    const summary = computeGameSummary(evalByPly, fens, 'w');
    expect(summary.acpl).toBeNull();
    expect(summary.accuracy).toBeNull();
  });

  it('mat bulunan pozisyon aşırı bir cp değeriyle işlenir (blunder sayılır)', () => {
    const evalByPly: Record<number, WhiteScore> = {
      0: { cp: 0, mate: null },
      1: { cp: null, mate: -3 }, // sporcu (beyaz) hamlesinden sonra SİYAH 3 hamlede mat ediyor
    };
    const fens = [START, START];
    const summary = computeGameSummary(evalByPly, fens, 'w');
    expect(summary.blunders).toBe(1);
  });

  it('hiç hamle yoksa (tek ply) tüm sayaçlar sıfır, ortalamalar null', () => {
    const summary = computeGameSummary({ 0: { cp: 0, mate: null } }, [START], 'w');
    expect(summary).toEqual({
      inaccuracies: 0, mistakes: 0, blunders: 0, acpl: null, accuracy: null,
      phaseAccuracy: { opening: null, middlegame: null, endgame: null },
    });
  });
});
