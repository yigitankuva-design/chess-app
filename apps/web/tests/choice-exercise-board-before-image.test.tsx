import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChoiceExerciseFields } from '@/components/admin/ChoiceExerciseFields';

describe('ChoiceExerciseFields — Görüntü ekle: tahta görsel SEÇMEDEN önce görünür (madde 1)', () => {
  it('hiç görsel yokken bile satranç tahtası zemini gösterilir', () => {
    render(<ChoiceExerciseFields kind="image_question" onSubmit={vi.fn()} />);
    // EmptyBoardGrid data-testid'i tahta zeminini işaretler.
    expect(screen.getByTestId('empty-board-grid')).toBeInTheDocument();
  });
});
