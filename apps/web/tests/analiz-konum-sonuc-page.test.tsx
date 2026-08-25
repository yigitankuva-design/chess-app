import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
let searchParamValue: string | null = null;
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({ get: (_key: string) => searchParamValue }),
}));
vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: vi.fn() }));
vi.mock('@/components/analiz/AnalysisBoard', () => ({
  AnalysisBoard: ({ fen }: { fen: string }) => <div data-testid="analysis-board" data-fen={fen} />,
}));

import KonumAnalizSonucPage from '@/app/(child)/analiz/konum/sonuc/page';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('KonumAnalizSonucPage (madde 2026-09-03 (7))', () => {
  it('adres parametresindeki fen ile AnalysisBoard gösterilir', async () => {
    searchParamValue = FEN;
    render(<KonumAnalizSonucPage />);
    expect(await screen.findByTestId('analysis-board')).toHaveAttribute('data-fen', FEN);
  });

  it('fen yoksa bilgi mesajı gösterir', async () => {
    searchParamValue = null;
    render(<KonumAnalizSonucPage />);
    expect(await screen.findByText('Analiz edilecek bir konum bulunamadı.')).toBeInTheDocument();
  });

  it('Geri butonu /analiz/konum\'a döner', async () => {
    searchParamValue = FEN;
    render(<KonumAnalizSonucPage />);
    fireEvent.click(await screen.findByLabelText('Geri'));
    expect(push).toHaveBeenCalledWith('/analiz/konum');
  });
});
