import { describe, it, expect } from 'vitest';
import { movePieceSteps, MOVE_PIECE_STEP_LABELS } from '@/lib/admin/movePieceSteps';
import type { MovePieceStepState } from '@/lib/admin/movePieceSteps';

const EMPTY_STATE: MovePieceStepState = {
  instruction: '', setupFen: '8/8/8/8/8/8/8/8 w - - 0 1', turnChosen: false,
  moveFen: null, moves: [], notationSaved: false, difficultyChosen: false,
};

describe('movePieceSteps — Yazı-Şekil-Renk Ekle adımı', () => {
  it('adım listesinde "Yazı-Şekil-Renk Ekle" bulunur, Soruyu Ekle\'den ÖNCE gelir', () => {
    expect(MOVE_PIECE_STEP_LABELS).toContain('Yazı-Şekil-Renk Ekle');
    const paintIdx = MOVE_PIECE_STEP_LABELS.indexOf('Yazı-Şekil-Renk Ekle');
    const addIdx = MOVE_PIECE_STEP_LABELS.indexOf('Soruyu Ekle');
    expect(paintIdx).toBeLessThan(addIdx);
  });

  it('opsiyonel — hiçbir şey eklenmese de adım done sayılır', () => {
    const steps = movePieceSteps(EMPTY_STATE);
    const paintStep = steps.find((s) => s.label === 'Yazı-Şekil-Renk Ekle');
    expect(paintStep?.done).toBe(true);
  });
});
