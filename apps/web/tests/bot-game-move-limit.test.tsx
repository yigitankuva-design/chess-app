import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return 'e7e5'; }
    async analyzeMultiPv() { return [{ scoreCp: 20, mate: null, pvUci: [] }]; }
    destroy() {}
  },
}));

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen, onPieceDrop }: { fen: string; onPieceDrop?: (f: string, t: string) => boolean }) => (
    <div data-testid="board" data-fen={fen}>
      <button type="button" onClick={() => onPieceDrop?.('e2', 'e4')}>oyna-e4</button>
    </div>
  ),
}));

vi.mock('@/lib/auth-storage', () => ({
  getToken: () => 'tok',
  getAthleteName: () => 'Ahmet',
}));

import { BotGame } from '@/components/BotGame';

beforeEach(() => {
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
});

describe('BotGame — moveLimit (madde 2026-09-06 üçüncü tur/4: Açılış Konumunu İlerlet)', () => {
  it('sporcu+bot moveLimit kadar (her taraf ayrı) hamle oynayınca pratik OTOMATİK biter', async () => {
    render(
      <BotGame skillLevel={1} depth={1} studentColor="w" moveLimit={1}
        onGameEnd={vi.fn()} practiceActions={{ onPlaySame: vi.fn(), onPlayDifferent: vi.fn() }} />,
    );
    await screen.findByTestId('board');
    // Sporcu 1. hamlesini oynar (e4); bot da kendi 1. hamlesini (e7e5) oynar
    // — moveLimit=1 olduğu için toplam 2 yarı-hamle sonra pratik biter.
    fireEvent.click(screen.getByText('oyna-e4'));

    await waitFor(() => expect(screen.getByText('İlerleme Tamamlandı')).toBeInTheDocument());
    // Mat/pat olmadığı için normal kazandın/kaybettin kartı GÖRÜNMEMELİ.
    expect(screen.queryByText('Tebrikler Kazandın')).not.toBeInTheDocument();
    // Pratik bittiği için "Terk Et" artık pasif, "Farklı Konum" aktif.
    await waitFor(() => expect(screen.getByLabelText('Terk Et')).toBeDisabled());
    expect(screen.getByLabelText('Farklı Bir Konumu Pratik Yap')).not.toBeDisabled();
  });

  it('moveLimit verilmezse eski davranış (pratik sadece mat/pat/terk ile biter) korunur', async () => {
    render(
      <BotGame skillLevel={1} depth={1} studentColor="w"
        onGameEnd={vi.fn()} practiceActions={{ onPlaySame: vi.fn(), onPlayDifferent: vi.fn() }} />,
    );
    await screen.findByTestId('board');
    fireEvent.click(screen.getByText('oyna-e4'));
    await waitFor(() => screen.getByTestId('board'));
    expect(screen.queryByText('İlerleme Tamamlandı')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Terk Et')).not.toBeDisabled();
  });
});
