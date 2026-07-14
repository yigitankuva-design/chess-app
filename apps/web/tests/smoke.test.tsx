import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

describe('HomePage', () => {
  it('renders the welcome heading', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { name: /Bozüyük Satranç Akademisi/i })
    ).toBeInTheDocument();
  });
});
