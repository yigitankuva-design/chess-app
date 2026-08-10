import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/ChessBoard', () => ({
  ChessBoard: ({ fen }: { fen: string }) => <div data-testid="board" data-fen={fen} />,
}));
vi.mock('@/lib/chess/stockfish', () => ({
  StockfishEngine: class {
    async init() {}
    setSkill() {}
    async bestMove() { return '(none)'; }
    destroy() {}
  },
}));
vi.mock('@/lib/auth-storage', () => ({
  getToken: () => 'tok',
  getAthleteName: () => 'Ahmet',
}));
vi.mock('@/lib/avatars', async () => {
  const actual = await vi.importActual<typeof import('@/lib/avatars')>('@/lib/avatars');
  return { ...actual, getSavedAvatar: () => 'unicorn' };
});
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ game_id: 1 }) }));

import { PositionPoolPractice } from '@/components/play/PositionPoolPractice';

const POOL = [
  { id: 'p1', fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' },
];

describe('PositionPoolPractice', () => {
  it('havuz boşsa bilgi mesajı gösterir, MatchCriteria hiç görünmez', () => {
    render(<PositionPoolPractice positions={[]} />);
    expect(screen.getByText(/Henüz konum eklenmedi/)).toBeInTheDocument();
    expect(screen.queryByText('Pratiğe Başla')).not.toBeInTheDocument();
  });

  it('havuz doluysa MatchCriteria gösterir', () => {
    render(<PositionPoolPractice positions={POOL} />);
    expect(screen.getByText(/Pratiğe Başla/)).toBeInTheDocument();
  });

  it('initialCriteria verilince kriter ekranı ATLANIR, tahta gelir', async () => {
    const { LEVELS, ALL_TIMES } = await import('@/lib/play/levels');
    render(
      <PositionPoolPractice
        positions={POOL}
        initialCriteria={{ level: LEVELS[0], timeControl: ALL_TIMES[0], colorChoice: 'white' }}
      />,
    );
    expect(screen.queryByText(/Pratiğe Başla/)).not.toBeInTheDocument();
    expect(await screen.findByTestId('board')).toBeInTheDocument();
  });
});

describe('PositionPoolPractice — başlıkta kod', () => {
  it('title verilince başlıkta bölüm adı ve konum kodu görünür', async () => {
    const { LEVELS, ALL_TIMES } = await import('@/lib/play/levels');
    render(
      <PositionPoolPractice
        title="Kale Finalleri"
        positions={[{ id: 'p1', fen: POOL[0].fen, code: '003' }]}
        initialCriteria={{ level: LEVELS[0], timeControl: ALL_TIMES[0], colorChoice: 'white' }}
      />,
    );
    expect(await screen.findByText(/Kale Finalleri/)).toBeInTheDocument();
    expect(screen.getByText(/003/)).toBeInTheDocument();
  });

  it('kodsuz konuma sırasına göre kod üretilir', async () => {
    const { LEVELS, ALL_TIMES } = await import('@/lib/play/levels');
    render(
      <PositionPoolPractice
        title="Piyon Finalleri"
        positions={[{ id: 'p1', fen: POOL[0].fen }]}
        initialCriteria={{ level: LEVELS[0], timeControl: ALL_TIMES[0], colorChoice: 'white' }}
      />,
    );
    expect(await screen.findByText(/001/)).toBeInTheDocument();
  });

  it('title verilmezse başlık çizilmez (eski kullanım bozulmaz)', () => {
    render(<PositionPoolPractice positions={POOL} />);
    expect(screen.getByText(/Pratiğe Başla/)).toBeInTheDocument();
  });
});
