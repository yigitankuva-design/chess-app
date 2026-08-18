import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

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

import { BotGame } from '@/components/BotGame';

function renderPractice(onPlaySame = vi.fn(), onPlayDifferent = vi.fn()) {
  render(
    <BotGame
      skillLevel={1} depth={1} studentColor="w"
      onGameEnd={() => {}}
      practiceActions={{ onPlaySame, onPlayDifferent }}
    />,
  );
  return { onPlaySame, onPlayDifferent };
}

describe('BotGame — practiceActions (madde 2: 4 dairesel kart)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ game_id: 1 }),
    }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('4 ikon\'lu kart görünür, YAZI etiketi (Beraberlik Teklif Et vb.) YOKTUR', async () => {
    renderPractice();
    await screen.findByTestId('board');
    expect(screen.getByLabelText('Aynı konumu tekrar pratik yap')).toBeInTheDocument();
    expect(screen.getByLabelText('Beraberlik teklif et')).toBeInTheDocument();
    expect(screen.getByLabelText('Pratiği terk et')).toBeInTheDocument();
    expect(screen.getByLabelText('Farklı bir konumu pratik yap')).toBeInTheDocument();
    expect(screen.queryByText(/Beraberlik Teklif Et/)).not.toBeInTheDocument();
    expect(screen.queryByText('Yeniden Oyna')).not.toBeInTheDocument();
  });

  it('maç bitmeden: Beraberlik + Terk Et AKTİF, Tekrar Et + Farklı Konum SÖNÜK', async () => {
    renderPractice();
    await screen.findByTestId('board');
    expect(screen.getByLabelText('Aynı konumu tekrar pratik yap')).toBeDisabled();
    expect(screen.getByLabelText('Beraberlik teklif et')).not.toBeDisabled();
    expect(screen.getByLabelText('Pratiği terk et')).not.toBeDisabled();
    expect(screen.getByLabelText('Farklı bir konumu pratik yap')).toBeDisabled();
  });

  it('Terk Et onaylanınca: kırmızı "Bot Kazandı" kartı çıkar, Tekrar Et + Farklı Konum AKTİFLEŞİR, Beraberlik + Terk Et SÖNER', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    renderPractice();
    await screen.findByTestId('board');
    fireEvent.click(screen.getByLabelText('Pratiği terk et'));

    await waitFor(() => screen.getByText('Bot Kazandı'));
    expect(screen.getByText('Bot Kazandı')).toHaveClass('t-err');
    expect(screen.getByLabelText('Aynı konumu tekrar pratik yap')).not.toBeDisabled();
    expect(screen.getByLabelText('Farklı bir konumu pratik yap')).not.toBeDisabled();
    expect(screen.getByLabelText('Beraberlik teklif et')).toBeDisabled();
    expect(screen.getByLabelText('Pratiği terk et')).toBeDisabled();
  });

  it('Terk Et onaylanmazsa (confirm false) maç devam eder', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    renderPractice();
    await screen.findByTestId('board');
    fireEvent.click(screen.getByLabelText('Pratiği terk et'));
    expect(screen.queryByText('Bot Kazandı')).not.toBeInTheDocument();
  });

  it('bot beraberliği kabul ederse mavi "Berabere Bitti" kartı çıkar', async () => {
    vi.doMock('@/lib/play/botDraw', () => ({ botAcceptsDraw: () => true }));
    vi.resetModules();
    const { BotGame: FreshBotGame } = await import('@/components/BotGame');
    render(
      <FreshBotGame skillLevel={1} depth={1} studentColor="w" onGameEnd={() => {}}
        practiceActions={{ onPlaySame: vi.fn(), onPlayDifferent: vi.fn() }} />,
    );
    await screen.findByTestId('board');
    fireEvent.click(screen.getByLabelText('Beraberlik teklif et'));
    await waitFor(() => screen.getByText('Berabere Bitti'));
    expect(screen.getByText('Berabere Bitti')).toHaveClass('t-info');
    vi.doUnmock('@/lib/play/botDraw');
  });

  it('maç bittikten sonra "tekrar et" ve "farklı konum" tıklanınca ilgili callback çağrılır', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const { onPlaySame } = renderPractice();
    await screen.findByTestId('board');
    fireEvent.click(screen.getByLabelText('Pratiği terk et'));
    await waitFor(() => screen.getByText('Bot Kazandı'));

    fireEvent.click(screen.getByLabelText('Aynı konumu tekrar pratik yap'));
    expect(onPlaySame).toHaveBeenCalled();
  });

  it('practiceActions verilmezse eski Beraberlik Teklif Et / Yeniden Oyna davranışı korunur', async () => {
    render(<BotGame skillLevel={1} depth={1} studentColor="w" onGameEnd={() => {}} />);
    await screen.findByTestId('board');
    await waitFor(() => screen.getByText(/Beraberlik Teklif Et/));
    expect(screen.queryByLabelText('Aynı konumu tekrar pratik yap')).not.toBeInTheDocument();
  });
});
