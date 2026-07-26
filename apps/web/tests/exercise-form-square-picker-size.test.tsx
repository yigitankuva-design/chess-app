import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExerciseForm } from '@/components/admin/ExerciseForm';

describe('ExerciseForm — SquarePicker kare boyutu', () => {
  it('kare butonları text-[15px] class ile render edilir', () => {
    render(<ExerciseForm onSubmit={vi.fn()} initial={{ type: 'click_square', instruction: 'x', fen: '8/8/8/8/8/8/8/8 w - - 0 1', target_squares: [] }} />);
    const btn = screen.getByText('e4');
    expect(btn.className).toMatch(/text-\[15px\]/);
  });
});
