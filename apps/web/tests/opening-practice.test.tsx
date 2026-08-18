import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/components/BotGame', () => ({
  BotGame: ({ startFen, practiceActions }: {
    startFen?: string;
    practiceActions?: { onPlaySame: () => void; onPlayDifferent: () => void };
  }) => (
    <div data-testid="bot-game" data-start-fen={startFen ?? ''}>
      {practiceActions && (
        <>
          <button onClick={practiceActions.onPlaySame}>test-play-same</button>
          <button onClick={practiceActions.onPlayDifferent}>test-play-different</button>
        </>
      )}
    </div>
  ),
}));

vi.mock('@/components/play/FriendChallenge', () => ({
  FriendChallenge: () => <div data-testid="friend-challenge" />,
}));

import { OpeningPractice } from '@/components/play/OpeningPractice';

const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => [{ id: 1, name: 'İtalyan Açılışı', start_fen: FEN, category: 'e4' }],
  })));
});

/** Bot kartini acar, tur secer (madde 4: liste bastan gizlidir) ve secilen
 *  turun acilis listesinin gorunmesini bekler. */
async function openBotCard() {
  fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
  fireEvent.click(screen.getByRole('button', { name: /1\. Açılış Türünü Seç/ }));
  fireEvent.click(await screen.findByText('e4 ile Başlayanlar'));
  await waitFor(() => expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument());
}

describe('OpeningPractice — akordiyon', () => {
  it('başlangıçta iki dış kart kapalıdır', () => {
    render(<OpeningPractice />);
    expect(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Arkadaşına Karşı Pratik Yap/ })).toBeInTheDocument();
    // Govdeler kapali: ic kartlarin basliklari DOM'da yok
    expect(screen.queryByText('1. Açılış Türünü Seç')).not.toBeInTheDocument();
    expect(screen.queryByTestId('friend-challenge')).not.toBeInTheDocument();
  });

  it('bot kartı açılınca üç kart görünür, açılış listesi yüklenir', async () => {
    render(<OpeningPractice />);
    await openBotCard();
    expect(screen.getByText('1. Açılış Türünü Seç')).toBeInTheDocument();
    expect(screen.getByText('2. Açılış Konumunu Seç')).toBeInTheDocument();
    expect(screen.getByText('3. Maç Kriterlerini Seç')).toBeInTheDocument();
  });

  it('KİLİT: açılış seçilmeden kriter kartı açılmaz', async () => {
    render(<OpeningPractice />);
    await openBotCard();
    const criteriaBtn = screen.getByRole('button', { name: /3\. Maç Kriterlerini Seç/ });
    expect(criteriaBtn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(criteriaBtn);
    expect(screen.queryByRole('button', { name: 'Düzey 1' })).not.toBeInTheDocument();
  });

  it('açılış seçilince 2. kart kapanır, ✓ özet çıkar, 3. kart kendiliğinden açılır', async () => {
    render(<OpeningPractice />);
    await openBotCard();
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    // 2. kart kapandi: listedeki secenek artik DOM'da degil
    expect(screen.queryByText('İtalyan Açılışı')).not.toBeInTheDocument();
    // Ozet basliga tasindi
    expect(screen.getByText('✓ İtalyan Açılışı')).toBeInTheDocument();
    // 3. kart acildi
    expect(screen.getByRole('button', { name: 'Düzey 1' })).toBeInTheDocument();
  });

  it('kapanan 2. karta tekrar tıklanınca açılış değiştirilebilir', async () => {
    render(<OpeningPractice />);
    await openBotCard();
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByRole('button', { name: /2\. Açılış Konumunu Seç/ }));
    await waitFor(() => expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument());
  });

  it('maç seçilen açılışın FENiyle başlar', async () => {
    render(<OpeningPractice />);
    await openBotCard();
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 2' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    expect(screen.getByTestId('bot-game').getAttribute('data-start-fen')).toBe(FEN);
  });

  it('practiceActions verilir: "tekrar et" aynı FEN\'i, "farklı konum" AYNI kategoriden BAŞKA bir açılışı seçer', async () => {
    const FEN2 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => [
        { id: 1, name: 'İtalyan Açılışı', start_fen: FEN, category: 'e4' },
        { id: 2, name: 'İspanyol Açılışı', start_fen: FEN2, category: 'e4' },
      ],
    })));
    // Math.random() 0 döner → pickDifferentPosition ilk uygun adayı seçer (deterministik).
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<OpeningPractice />);
    await openBotCard();
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 2' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    expect(screen.getByTestId('bot-game').getAttribute('data-start-fen')).toBe(FEN);

    fireEvent.click(screen.getByText('test-play-different'));
    await waitFor(() =>
      expect(screen.getByTestId('bot-game').getAttribute('data-start-fen')).toBe(FEN2),
    );
    vi.restoreAllMocks();
  });

  it('practiceActions "tekrar et": aynı açılışla devam eder (FEN değişmez)', async () => {
    render(<OpeningPractice />);
    await openBotCard();
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 2' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    fireEvent.click(screen.getByText('test-play-same'));
    expect(screen.getByTestId('bot-game').getAttribute('data-start-fen')).toBe(FEN);
  });

  it('arkadaş kartı açılınca arkadaş seçme ekranı görünür (açılış seçtirmeden)', () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByRole('button', { name: /Arkadaşına Karşı Pratik Yap/ }));
    expect(screen.getByTestId('friend-challenge')).toBeInTheDocument();
  });

  it('dış akordiyon tek-açık: arkadaş açılınca bot kapanır', async () => {
    render(<OpeningPractice />);
    await openBotCard();
    fireEvent.click(screen.getByRole('button', { name: /Arkadaşına Karşı Pratik Yap/ }));
    expect(screen.queryByText('1. Açılış Türünü Seç')).not.toBeInTheDocument();
    expect(screen.getByTestId('friend-challenge')).toBeInTheDocument();
  });

  it('REGRESYON: açılış listesi boşsa bilgi mesajı gösterilir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
    render(<OpeningPractice />);
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    fireEvent.click(screen.getByRole('button', { name: /1\. Açılış Türünü Seç/ }));
    fireEvent.click(await screen.findByText('e4 ile Başlayanlar'));
    await waitFor(() =>
      expect(screen.getByText(/Bu türde henüz açılış yok/i)).toBeInTheDocument(),
    );
  });
});
