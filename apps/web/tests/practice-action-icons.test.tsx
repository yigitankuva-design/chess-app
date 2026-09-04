import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { FlipBoardIcon, ReplayIcon } from '@/components/play/PracticeActionIcons';

describe('ReplayIcon — madde 2026-09-06 (ikinci tur/D1): %30 büyütülmüş, kalınlaştırılmış', () => {
  it('26x26 boyutta ve strokeWidth 3 ile render edilir', () => {
    const { container } = render(<ReplayIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '26');
    expect(svg).toHaveAttribute('height', '26');
    expect(svg).toHaveAttribute('stroke-width', '3');
  });
});

describe('FlipBoardIcon', () => {
  it('90 derece döndürülmüş bir span içinde render edilir', () => {
    const { container } = render(<FlipBoardIcon />);
    const span = container.querySelector('span');
    expect(span).toHaveStyle({ transform: 'rotate(90deg)' });
  });
});
