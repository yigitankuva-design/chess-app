import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BoardExercise } from '@/components/lesson-steps/BoardExercise';
import type { BoardExerciseConfig } from '@/components/lesson-steps/BoardExercise';

const clickEx: BoardExerciseConfig = {
  type: 'click_square',
  instruction: 'Beyaz şaha tıkla',
  fen: '8/8/8/8/4K3/8/8/8 w - - 0 1',
  target_squares: ['e4'],
  code: '004',
};

const choiceEx: BoardExerciseConfig = {
  type: 'sentence_question',
  instruction: 'Doğru olanı seç',
  options: ['A Şıkkı', 'B Şıkkı', 'C Şıkkı'],
  correct_index: 0,
  answer_kind: 'sentence',
  code: '007',
};

function renderEx(exercise: BoardExerciseConfig) {
  return render(
    <BoardExercise exercises={[exercise]} done={false} onCorrect={vi.fn()} />,
  );
}

describe('BoardExercise — dikey/yatay yerleşim iskeleti', () => {
  it('tahta ve içerik AYRI alanlara konur (tek grid, tek DOM ağacı)', () => {
    const { container } = renderEx(clickEx);
    expect(container.querySelector('.practice-grid')).toBeInTheDocument();
    expect(container.querySelectorAll('.pg-board')).toHaveLength(1);
    expect(container.querySelectorAll('.pg-content')).toHaveLength(1);
  });

  it('tahta kutusu board alanının İÇİNDE durur', () => {
    const { container } = renderEx(clickEx);
    const board = container.querySelector('.pg-board');
    expect(board?.querySelector('[data-testid="board-exercise-coord-frame"]')).toBeInTheDocument();
  });

  it('talimat kartı content alanının İÇİNDE durur', () => {
    const { container } = renderEx(clickEx);
    const content = container.querySelector('.pg-content');
    expect(content?.textContent).toContain('Beyaz şaha tıkla');
  });

  it('çoktan seçmeli soruda şıklar content alanında durur', () => {
    const { container } = renderEx(choiceEx);
    const content = container.querySelector('.pg-content');
    expect(content?.textContent).toContain('A Şıkkı');
    expect(content?.textContent).toContain('C Şıkkı');
  });

  it('görseli OLMAYAN çoktan seçmeli soruda yatay mod tek sütuna düşer (boş sütun kalmaz)', () => {
    const { container } = renderEx(choiceEx);
    expect(container.querySelector('.practice-grid')).toHaveClass('practice-grid-solo');
  });

  it('tahtası OLAN soruda tek sütun işareti KONMAZ', () => {
    const { container } = renderEx(clickEx);
    expect(container.querySelector('.practice-grid')).not.toHaveClass('practice-grid-solo');
  });

  it('KOD yazısı board alanında görünür, ilerleme çubuğunun yanındaki eski rozet YOKTUR', () => {
    const { container } = renderEx(clickEx);
    const board = container.querySelector('.pg-board');
    expect(board?.querySelector('.pg-code')?.textContent).toContain('004');
    // Eski rozet ("#004") kaldırıldı — kod SADECE bir kez görünür.
    expect(screen.queryByText('#004')).not.toBeInTheDocument();
  });
});
