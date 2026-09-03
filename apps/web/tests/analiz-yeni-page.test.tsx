import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const push = vi.fn();
const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace }) }));
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

  it('madde 2026-09-04 (4): kendi "Geri" butonunu ÇİZMEZ — AppNav\'ın tek butonu bu sayfada da geçerli', () => {
    render(<YeniAnalizPage />);
    expect(screen.queryByLabelText('Geri')).not.toBeInTheDocument();
  });
});

describe('YeniAnalizPage — madde 2026-09-05 (3): admin bu özelliği kapattıysa', () => {
  it('analizFeatures.freePlay=false iken /home\'a yönlendirir', async () => {
    vi.resetModules();
    vi.doMock('@/lib/settings/settings-context', () => ({
      useSettings: () => ({ settings: { analizFeatures: { matches: true, freePlay: false, position: true } } }),
    }));
    const { default: Page } = await import('@/app/(child)/analiz/yeni/page');
    render(<Page />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
  });
});
