import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: vi.fn() }));
vi.mock('@/components/analiz/CustomPositionAnalysis', () => ({
  CustomPositionAnalysis: () => <div data-testid="custom-position-analysis" />,
}));

import KonumAnalizPage from '@/app/(child)/analiz/konum/page';
import { useTabGuard } from '@/lib/settings/useTabGuard';

describe('KonumAnalizPage (madde 2026-09-02 (5))', () => {
  it('useTabGuard(\'analiz\') çağrılır', () => {
    render(<KonumAnalizPage />);
    expect(useTabGuard).toHaveBeenCalledWith('analiz');
  });

  it('başlık ve CustomPositionAnalysis (konum ekleme + analiz) gösterilir', () => {
    render(<KonumAnalizPage />);
    expect(screen.getByText('Konum Analizi')).toBeInTheDocument();
    expect(screen.getByTestId('custom-position-analysis')).toBeInTheDocument();
  });

  it('Geri butonu /home\'a yönlendirir', () => {
    render(<KonumAnalizPage />);
    fireEvent.click(screen.getByLabelText('Geri'));
    expect(push).toHaveBeenCalledWith('/home');
  });
});
