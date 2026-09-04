import { describe, it, expect } from 'vitest';
import { computeMoveLimitVerdict } from '@/lib/chess/moveLimitAnalysis';
import type { WhiteScore } from '@/lib/chess/moveQuality';

describe('computeMoveLimitVerdict', () => {
  it('start veya end henüz değerlendirilmediyse null döner', () => {
    expect(computeMoveLimitVerdict(undefined, { cp: 50, mate: null }, 'w')).toBeNull();
    expect(computeMoveLimitVerdict({ cp: 50, mate: null }, undefined, 'w')).toBeNull();
  });

  it('beyaz sporcu: skor artınca deltaCp pozitiftir (iyileşti)', () => {
    const start: WhiteScore = { cp: 20, mate: null };
    const end: WhiteScore = { cp: 120, mate: null };
    const v = computeMoveLimitVerdict(start, end, 'w');
    expect(v).toEqual({ startCp: 20, endCp: 120, deltaCp: 100 });
  });

  it('siyah sporcu: beyaz açısından skor düşünce (siyah lehine) deltaCp pozitiftir', () => {
    const start: WhiteScore = { cp: 50, mate: null };
    const end: WhiteScore = { cp: -50, mate: null };
    const v = computeMoveLimitVerdict(start, end, 'b');
    // Siyah açısından: -50 → +50, kayıp -50'den kazanç +50'ye — iyileşti.
    expect(v).toEqual({ startCp: -50, endCp: 50, deltaCp: 100 });
  });

  it('mat skorları da (aşırı büyük cp olarak) hesaba katılır', () => {
    const start: WhiteScore = { cp: 0, mate: null };
    const end: WhiteScore = { cp: null, mate: 3 }; // beyaz 3 hamlede mat ediyor
    const v = computeMoveLimitVerdict(start, end, 'w');
    expect(v?.deltaCp).toBeGreaterThan(90_000); // net bir iyileşme
  });
});
