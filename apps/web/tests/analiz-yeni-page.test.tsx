import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: vi.fn() }));
vi.mock('@/components/analiz/FreePlayAnalysis', () => ({
  FreePlayAnalysis: () => <div data-testid="freeplay-analysis" />,
}));

import YeniAnalizPage from '@/app/(child)/analiz/yeni/page';
import { useTabGuard } from '@/lib/settings/useTabGuard';

describe('YeniAnalizPage (madde 2026-09-02 (1)(2)(3))', () => {
  it('useTabGuard(\'analiz\') çağrılır', () => {
    render(<YeniAnalizPage />);
    expect(useTabGuard).toHaveBeenCalledWith('analiz');
  });

  it('başlık ve FreePlayAnalysis gösterilir — maç listesi YOK', () => {
    render(<YeniAnalizPage />);
    expect(screen.getByText('Yeni Analiz')).toBeInTheDocument();
    expect(screen.getByTestId('freeplay-analysis')).toBeInTheDocument();
  });

  it('Geri butonu /home\'a yönlendirir', () => {
    render(<YeniAnalizPage />);
    fireEvent.click(screen.getByLabelText('Geri'));
    expect(push).toHaveBeenCalledWith('/home');
  });
});
