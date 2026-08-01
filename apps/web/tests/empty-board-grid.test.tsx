import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { EmptyBoardGrid } from '@/components/chess/EmptyBoardGrid';

describe('EmptyBoardGrid', () => {
  it('64 kare render eder', () => {
    const { container } = render(<EmptyBoardGrid />);
    const grid = container.querySelector('[data-testid="empty-board-grid"] > div');
    expect(grid?.children.length).toBe(64);
  });

  it('children prop ile üzerine katman eklenebilir', () => {
    const { getByText } = render(
      <EmptyBoardGrid><span>üst katman</span></EmptyBoardGrid>,
    );
    expect(getByText('üst katman')).toBeInTheDocument();
  });
});
