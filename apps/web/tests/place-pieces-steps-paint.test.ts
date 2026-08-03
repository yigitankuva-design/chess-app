import { describe, it, expect } from 'vitest';
import { placePiecesSteps, PLACE_PIECES_STEP_LABELS } from '@/lib/admin/placePiecesSteps';
import type { PlacePiecesStepState } from '@/lib/admin/placePiecesSteps';

const EMPTY_STATE: PlacePiecesStepState = {
  instruction: '', setupFen: '8/8/8/8/8/8/8/8 w - - 0 1', savedFen: null,
  selectedPiece: null, pieces: [], answerSaved: false, turnChosen: false, difficultyChosen: false,
};

describe('placePiecesSteps — Yazı-Şekil-Renk Ekle adımı', () => {
  it('adım listesinde bulunur ve opsiyoneldir', () => {
    expect(PLACE_PIECES_STEP_LABELS).toContain('Yazı-Şekil-Renk Ekle');
    const steps = placePiecesSteps(EMPTY_STATE);
    expect(steps.find((s) => s.label === 'Yazı-Şekil-Renk Ekle')?.done).toBe(true);
  });
});
