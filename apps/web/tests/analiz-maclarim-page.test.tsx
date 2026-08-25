import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: vi.fn() }));
vi.mock('@/components/analiz/GameAnalysisSection', () => ({
  GameAnalysisSection: () => <div data-testid="game-analysis-section" />,
}));

import MaclarimAnalizPage from '@/app/(child)/analiz/maclarim/page';
import { useTabGuard } from '@/lib/settings/useTabGuard';

describe('MaclarimAnalizPage (madde 2026-09-02 (4))', () => {
  it('useTabGuard(\'analiz\') çağrılır', () => {
    render(<MaclarimAnalizPage />);
    expect(useTabGuard).toHaveBeenCalledWith('analiz');
  });

  it('başlık ve GameAnalysisSection (maç listesi + inceleme) gösterilir', () => {
    render(<MaclarimAnalizPage />);
    expect(screen.getByText('Maçlarımın Analizi')).toBeInTheDocument();
    expect(screen.getByTestId('game-analysis-section')).toBeInTheDocument();
  });

  it('Geri butonu /home\'a yönlendirir', () => {
    render(<MaclarimAnalizPage />);
    fireEvent.click(screen.getByLabelText('Geri'));
    expect(push).toHaveBeenCalledWith('/home');
  });
});
