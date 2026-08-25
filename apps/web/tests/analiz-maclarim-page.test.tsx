import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
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

describe('MaclarimAnalizPage — madde 2026-09-05 (3): admin bu özelliği kapattıysa', () => {
  it('analizFeatures.matches=false iken /home\'a yönlendirir', async () => {
    vi.resetModules();
    vi.doMock('@/lib/settings/settings-context', () => ({
      useSettings: () => ({ settings: { analizFeatures: { matches: false, freePlay: true, position: true } } }),
    }));
    const { default: Page } = await import('@/app/(child)/analiz/maclarim/page');
    render(<Page />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
  });
});
