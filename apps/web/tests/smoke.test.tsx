import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import HomePage from '@/app/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ login: vi.fn(), logout: vi.fn(), token: null, role: null, userId: null }),
}));

describe('HomePage', () => {
  it('renders the academy heading and login button', () => {
    render(<HomePage />);
    expect(
      screen.getByRole('heading', { name: /Bozüyük Satranç Akademisi/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Giriş Yap/i })
    ).toBeInTheDocument();
  });
});
