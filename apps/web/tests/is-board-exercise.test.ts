import { describe, it, expect } from 'vitest';
import { isBoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const clickSquare: BoardExerciseConfig = {
  type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: ['e4'],
};
const movePiece: BoardExerciseConfig = {
  type: 'move_piece', instruction: 'x', fen: '8/8/8/8/8/8/4P3/8 w - - 0 1',
  piece_square: 'e2', target_squares: ['e4'],
};
const identifyPiece: BoardExerciseConfig = {
  type: 'identify_piece', instruction: 'x', fen: '8/8/8/8/4n3/8/8/8 b - - 0 1',
  highlight_square: 'e4', options: ['At', 'Fil'], correct_index: 0,
};
const sentenceQuestion: BoardExerciseConfig = {
  type: 'sentence_question', instruction: 'Atın hareketi?',
  answer_kind: 'sentence', options: ['L şeklinde', 'Düz'], correct_index: 0,
};
const imageQuestion: BoardExerciseConfig = {
  type: 'image_question', instruction: '', prompt_image: 'data:image/jpeg;base64,AAA',
  answer_kind: 'sentence', options: ['A', 'B'], correct_index: 1,
};

describe('isBoardExercise', () => {
  it('tahta tabanlı 3 tip için true döner', () => {
    expect(isBoardExercise(clickSquare)).toBe(true);
    expect(isBoardExercise(movePiece)).toBe(true);
    expect(isBoardExercise(identifyPiece)).toBe(true);
  });

  it('seçenek tabanlı 2 yeni tip için false döner', () => {
    expect(isBoardExercise(sentenceQuestion)).toBe(false);
    expect(isBoardExercise(imageQuestion)).toBe(false);
  });
});
