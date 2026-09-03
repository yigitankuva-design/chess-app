import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
const replace = vi.fn();
let searchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
  useSearchParams: () => searchParams,
}));
vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: vi.fn() }));
vi.mock('@/components/analiz/GameAnalysisSection', () => ({
  // Madde 2026-09-03 (2): initialGameId'nin sayfadan doğru geldiğini
  // görünür kılmak için prop'u DOM'a yazar.
  GameAnalysisSection: ({ initialGameId }: { initialGameId?: number | null }) => (
    <div data-testid="game-analysis-section" data-initial-game-id={initialGameId ?? ''} />
  ),
}));

import MaclarimAnalizPage from '@/app/(child)/analiz/maclarim/page';
import { useTabGuard } from '@/lib/settings/useTabGuard';

describe('MaclarimAnalizPage (madde 2026-09-02 (4))', () => {
  beforeEach(() => { searchParams = new URLSearchParams(); });

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

describe('MaclarimAnalizPage — madde 2026-09-03 (2): ?gameId= ile doğrudan maç açma', () => {
  beforeEach(() => { searchParams = new URLSearchParams(); });

  it('?gameId= yoksa initialGameId null geçilir', () => {
    render(<MaclarimAnalizPage />);
    expect(screen.getByTestId('game-analysis-section')).toHaveAttribute('data-initial-game-id', '');
  });

  it('?gameId=42 varsa initialGameId=42 olarak geçilir', () => {
    searchParams = new URLSearchParams('gameId=42');
    render(<MaclarimAnalizPage />);
    expect(screen.getByTestId('game-analysis-section')).toHaveAttribute('data-initial-game-id', '42');
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
