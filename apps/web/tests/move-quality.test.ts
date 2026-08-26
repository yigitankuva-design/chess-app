import { describe, it, expect } from 'vitest';
import { classifyMoveQuality } from '@/lib/chess/moveQuality';

const noScore = { cp: null, mate: null };

describe('classifyMoveQuality — eşikler (madde 2026-09-05 (3))', () => {
  it('küçük değişimler (<200cp) işaretlenmez', () => {
    expect(classifyMoveQuality({ cp: 20, mate: null }, { cp: -20, mate: null }, 'w')).toBeNull();
    expect(classifyMoveQuality({ cp: 0, mate: null }, { cp: 150, mate: null }, 'b')).toBeNull();
  });

  it('beyaz 200-299cp kötüleşince "?" (kötü, kırmızı)', () => {
    const result = classifyMoveQuality({ cp: 100, mate: null }, { cp: -120, mate: null }, 'w');
    expect(result).toEqual({ symbol: '?', tone: 'bad' });
  });

  it('beyaz 300cp+ kötüleşince "??" (çok kötü, kırmızı)', () => {
    const result = classifyMoveQuality({ cp: 100, mate: null }, { cp: -250, mate: null }, 'w');
    expect(result).toEqual({ symbol: '??', tone: 'bad' });
  });

  it('beyaz 200-299cp iyileşince "!" (iyi, açık mavi)', () => {
    const result = classifyMoveQuality({ cp: 0, mate: null }, { cp: 220, mate: null }, 'w');
    expect(result).toEqual({ symbol: '!', tone: 'good' });
  });

  it('beyaz 300cp+ iyileşince "!!" (çok iyi, açık mavi)', () => {
    const result = classifyMoveQuality({ cp: 0, mate: null }, { cp: 350, mate: null }, 'w');
    expect(result).toEqual({ symbol: '!!', tone: 'good' });
  });

  it('mover SİYAH iken yön TERSİNE çevrilir — beyaz skoru artsa da siyah için kötüdür', () => {
    // Beyaz açısından skor +100 → +400 (beyaz lehine büyüdü) = siyahın hamlesi siyahı kötüleştirdi.
    const result = classifyMoveQuality({ cp: 100, mate: null }, { cp: 400, mate: null }, 'b');
    expect(result).toEqual({ symbol: '??', tone: 'bad' });
  });

  it('mat skorları büyük bir centipawn eşdeğerine çevrilip aynı eşiklerle değerlendirilir', () => {
    // Beyaz mat-3'ten mat kaçırmaya (mate:null, cp:0) düşerse beyaz için ÇOK KÖTÜ.
    const result = classifyMoveQuality({ cp: null, mate: 3 }, { cp: 0, mate: null }, 'w');
    expect(result).toEqual({ symbol: '??', tone: 'bad' });
  });

  it('skor eksikse (henüz hesaplanmamış) null döner', () => {
    expect(classifyMoveQuality(noScore, { cp: -300, mate: null }, 'w')).toBeNull();
    expect(classifyMoveQuality({ cp: -300, mate: null }, noScore, 'w')).toBeNull();
  });
});
