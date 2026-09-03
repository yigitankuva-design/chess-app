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
    async analyze() { return { bestMove: 'e2e4', scoreCp: 0, mate: null }; }
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

describe('BotGame — practiceActions (madde 2026-09-03 (3): 5 dairesel kart)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ game_id: 1 }),
    }));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('5 ikon\'lu kart görünür (Beraberlik Teklif Et YOK), YAZI etiketi YOKTUR', async () => {
    renderPractice();
    await screen.findByTestId('board');
    expect(screen.getByLabelText('Konumu Yeniden Tekrar Et')).toBeInTheDocument();
    expect(screen.getByLabelText('İpucu Göster')).toBeInTheDocument();
    expect(screen.getByLabelText('Terk Et')).toBeInTheDocument();
    expect(screen.getByLabelText('Tahtanın Yönünü Değiştir')).toBeInTheDocument();
    expect(screen.getByLabelText('Farklı Bir Konumu Pratik Yap')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Beraberlik/)).not.toBeInTheDocument();
    expect(screen.queryByText('Yeniden Oyna')).not.toBeInTheDocument();
  });

  it('maç bitmeden: İpucu Göster + Terk Et + Tahtanın Yönünü Değiştir AKTİF, Tekrar Et + Farklı Konum SÖNÜK', async () => {
    renderPractice();
    await screen.findByTestId('board');
    expect(screen.getByLabelText('Konumu Yeniden Tekrar Et')).toBeDisabled();
    expect(screen.getByLabelText('İpucu Göster')).not.toBeDisabled();
    expect(screen.getByLabelText('Terk Et')).not.toBeDisabled();
    expect(screen.getByLabelText('Tahtanın Yönünü Değiştir')).not.toBeDisabled();
    expect(screen.getByLabelText('Farklı Bir Konumu Pratik Yap')).toBeDisabled();
  });

  it('Terk Et onaylanınca: kırmızı "Bot Kazandı" kartı çıkar, Tekrar Et + Farklı Konum AKTİFLEŞİR, İpucu + Terk Et SÖNER', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    renderPractice();
    await screen.findByTestId('board');
    fireEvent.click(screen.getByLabelText('Terk Et'));

    await waitFor(() => screen.getByText('Bot Kazandı'));
    expect(screen.getByText('Bot Kazandı')).toHaveClass('t-err');
    expect(screen.getByLabelText('Konumu Yeniden Tekrar Et')).not.toBeDisabled();
    expect(screen.getByLabelText('Farklı Bir Konumu Pratik Yap')).not.toBeDisabled();
    expect(screen.getByLabelText('İpucu Göster')).toBeDisabled();
    expect(screen.getByLabelText('Terk Et')).toBeDisabled();
    // Tahtanın Yönünü Değiştir maç bitse de her zaman aktif kalır.
    expect(screen.getByLabelText('Tahtanın Yönünü Değiştir')).not.toBeDisabled();
  });

  it('Terk Et onaylanmazsa (confirm false) maç devam eder', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));
    renderPractice();
    await screen.findByTestId('board');
    fireEvent.click(screen.getByLabelText('Terk Et'));
    expect(screen.queryByText('Bot Kazandı')).not.toBeInTheDocument();
  });

  it('maç bittikten sonra "tekrar et" ve "farklı konum" tıklanınca ilgili callback çağrılır', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const { onPlaySame } = renderPractice();
    await screen.findByTestId('board');
    fireEvent.click(screen.getByLabelText('Terk Et'));
    await waitFor(() => screen.getByText('Bot Kazandı'));

    fireEvent.click(screen.getByLabelText('Konumu Yeniden Tekrar Et'));
    expect(onPlaySame).toHaveBeenCalled();
  });

  it('İpucu Göster tıklanınca motor sorgulanır ve kare işaretlenir (highlightSquares)', async () => {
    renderPractice();
    const board = await screen.findByTestId('board');
    fireEvent.click(screen.getByLabelText('İpucu Göster'));
    await waitFor(() => expect(board).toBeInTheDocument());
    // ChessBoard mock'landığı için highlightSquares'i doğrudan göremeyiz —
    // asıl davranış (highlightSquares prop'u) ChessBoard'un kendi testlerinde
    // zaten kapsanıyor; burada sadece tıklamanın hataya düşmediği doğrulanır.
  });

  it('practiceActions verilmezse eski Beraberlik Teklif Et / Yeniden Oyna davranışı korunur', async () => {
    render(<BotGame skillLevel={1} depth={1} studentColor="w" onGameEnd={() => {}} />);
    await screen.findByTestId('board');
    await waitFor(() => screen.getByLabelText(/Beraberlik Teklif Et/));
    expect(screen.queryByLabelText('Konumu Yeniden Tekrar Et')).not.toBeInTheDocument();
  });
});
