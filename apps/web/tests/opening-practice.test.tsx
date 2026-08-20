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
import type { MatchCriteriaValue } from '@/components/play/MatchCriteria';

const CRITERIA: MatchCriteriaValue = {
  level: { level: 7, skill: 13, depth: 9, blunderChance: 0 },
  timeControl: { label: '5+0', base: 300, increment: 0 },
  colorChoice: 'white',
  rated: false,
};

const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1';

function openingsFixture() {
  return [{
    id: 1, name: 'İtalyan Açılışı', category: 'e4',
    variants: [{ id: 11, name: 'Klasik Varyant', start_fen: FEN }],
  }];
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => openingsFixture(),
  })));
});

/** Bot kartini acar, tur secer, acilis ismini secer ve varyant listesinin
 *  gorunmesini bekler (madde: 2026-08-20 — 4 adimli akis). */
async function openToVariantList() {
  fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
  fireEvent.click(screen.getByRole('button', { name: /1\. Açılış Türünü Seç/ }));
  fireEvent.click(await screen.findByText("e4'lü Açılışlar"));
  await waitFor(() => expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument());
  fireEvent.click(screen.getByText('İtalyan Açılışı'));
  await waitFor(() => expect(screen.getByText('Klasik Varyant')).toBeInTheDocument());
}

async function pickVariantAndStartCriteria() {
  await openToVariantList();
  fireEvent.click(screen.getByText('Klasik Varyant'));
  fireEvent.click(screen.getByRole('button', { name: 'Orta' }));
  fireEvent.click(screen.getByRole('button', { name: '5+0' }));
}

describe('OpeningPractice — akordiyon (madde: 2026-08-20, 4 adım)', () => {
  it('başlangıçta iki dış kart kapalıdır', () => {
    render(<OpeningPractice />);
    expect(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Arkadaşına Karşı Pratik Yap/ })).toBeInTheDocument();
    // Govdeler kapali: ic kartlarin basliklari DOM'da yok
    expect(screen.queryByText('1. Açılış Türünü Seç')).not.toBeInTheDocument();
    expect(screen.queryByTestId('friend-challenge')).not.toBeInTheDocument();
  });

  it('bot kartı açılınca DÖRT kart görünür, açılış listesi yüklenir', async () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    expect(screen.getByText('1. Açılış Türünü Seç')).toBeInTheDocument();
    expect(screen.getByText('2. Açılış İsmini Seç')).toBeInTheDocument();
    expect(screen.getByText('3. Varyant Seç')).toBeInTheDocument();
    expect(screen.getByText('4. Maç Kriterlerini Seç')).toBeInTheDocument();
  });

  it('KİLİT: varyant seçilmeden kriter kartı açılmaz', async () => {
    render(<OpeningPractice />);
    await openToVariantList();
    const criteriaBtn = screen.getByRole('button', { name: /4\. Maç Kriterlerini Seç/ });
    expect(criteriaBtn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(criteriaBtn);
    expect(screen.queryByRole('button', { name: 'Kolay' })).not.toBeInTheDocument();
  });

  it('KİLİT: açılış ismi seçilmeden varyant kartı açılmaz', async () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    const variantBtn = screen.getByRole('button', { name: /3\. Varyant Seç/ });
    expect(variantBtn).toHaveAttribute('aria-disabled', 'true');
  });

  it('açılış ismi seçilince 2. kart kapanır, ✓ özet çıkar, 3. kart (varyant) kendiliğinden açılır', async () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    fireEvent.click(screen.getByRole('button', { name: /1\. Açılış Türünü Seç/ }));
    fireEvent.click(await screen.findByText("e4'lü Açılışlar"));
    await waitFor(() => expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument());
    fireEvent.click(screen.getByText('İtalyan Açılışı'));
    // 2. kart kapandi: listedeki secenek artik DOM'da degil
    expect(screen.queryByText('İtalyan Açılışı')).not.toBeInTheDocument();
    // Ozet basliga tasindi
    expect(screen.getByText('✓ İtalyan Açılışı')).toBeInTheDocument();
    // 3. kart (varyant) acildi
    expect(screen.getByText('Klasik Varyant')).toBeInTheDocument();
  });

  it('varyant seçilince 3. kart kapanır, ✓ özet çıkar, 4. kart kendiliğinden açılır', async () => {
    render(<OpeningPractice />);
    await openToVariantList();
    fireEvent.click(screen.getByText('Klasik Varyant'));
    expect(screen.queryByText('Klasik Varyant')).not.toBeInTheDocument();
    expect(screen.getByText('✓ Klasik Varyant')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kolay' })).toBeInTheDocument();
  });

  it('maç seçilen VARYANTIN FEN\'iyle başlar', async () => {
    render(<OpeningPractice />);
    await pickVariantAndStartCriteria();
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    expect(screen.getByTestId('bot-game').getAttribute('data-start-fen')).toBe(FEN);
  });

  it('practiceActions "tekrar et": aynı varyantla devam eder (FEN değişmez)', async () => {
    render(<OpeningPractice />);
    await pickVariantAndStartCriteria();
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    fireEvent.click(screen.getByText('test-play-same'));
    expect(screen.getByTestId('bot-game').getAttribute('data-start-fen')).toBe(FEN);
  });

  it('practiceActions "farklı konum": AYNI kategorideki BAŞKA bir varyantı seçer', async () => {
    const FEN2 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => [{
        id: 1, name: 'İtalyan Açılışı', category: 'e4',
        variants: [
          { id: 11, name: 'Klasik Varyant', start_fen: FEN },
          { id: 12, name: 'Giuoco Piano', start_fen: FEN2 },
        ],
      }],
    })));
    // Math.random() 0 döner → pickDifferentPosition ilk uygun adayı seçer (deterministik).
    vi.spyOn(Math, 'random').mockReturnValue(0);
    render(<OpeningPractice />);
    await pickVariantAndStartCriteria();
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    expect(screen.getByTestId('bot-game').getAttribute('data-start-fen')).toBe(FEN);

    fireEvent.click(screen.getByText('test-play-different'));
    await waitFor(() =>
      expect(screen.getByTestId('bot-game').getAttribute('data-start-fen')).toBe(FEN2),
    );
    vi.restoreAllMocks();
  });

  it('arkadaş kartı açılınca arkadaş seçme ekranı görünür (açılış seçtirmeden)', () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByRole('button', { name: /Arkadaşına Karşı Pratik Yap/ }));
    expect(screen.getByTestId('friend-challenge')).toBeInTheDocument();
  });

  it('dış akordiyon tek-açık: arkadaş açılınca bot kapanır', async () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    fireEvent.click(screen.getByRole('button', { name: /Arkadaşına Karşı Pratik Yap/ }));
    expect(screen.queryByText('1. Açılış Türünü Seç')).not.toBeInTheDocument();
    expect(screen.getByTestId('friend-challenge')).toBeInTheDocument();
  });

  it('REGRESYON: açılış listesi boşsa bilgi mesajı gösterilir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
    render(<OpeningPractice />);
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    fireEvent.click(screen.getByRole('button', { name: /1\. Açılış Türünü Seç/ }));
    fireEvent.click(await screen.findByText("e4'lü Açılışlar"));
    await waitFor(() =>
      expect(screen.getByText(/Bu türde henüz açılış yok/i)).toBeInTheDocument(),
    );
  });

  it('açılışın hiç varyantı yoksa bilgi mesajı gösterilir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => [{ id: 1, name: 'Varyantsız', category: 'e4', variants: [] }],
    })));
    render(<OpeningPractice />);
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    fireEvent.click(screen.getByRole('button', { name: /1\. Açılış Türünü Seç/ }));
    fireEvent.click(await screen.findByText("e4'lü Açılışlar"));
    await waitFor(() => expect(screen.getByText('Varyantsız')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Varyantsız'));
    await waitFor(() =>
      expect(screen.getByText(/Bu açılışta henüz varyant yok/i)).toBeInTheDocument(),
    );
  });
});

describe('OpeningPractice — onReadyToStart (madde: pratik ayrı sayfada oynanır, 2026-08-19)', () => {
  it('verilirse "Pratiğe Başla" maçı BURADA AÇMAZ, seçilen VARYANT+kriterle callback çağırır', async () => {
    const onReadyToStart = vi.fn();
    render(<OpeningPractice onReadyToStart={onReadyToStart} />);
    await pickVariantAndStartCriteria();
    fireEvent.click(screen.getByRole('button', { name: /Pratiğe Başla/ }));
    expect(onReadyToStart).toHaveBeenCalledTimes(1);
    expect(onReadyToStart.mock.calls[0][0]).toMatchObject({ id: 11, name: 'Klasik Varyant', start_fen: FEN });
    expect(onReadyToStart.mock.calls[0][1].level.level).toBe(5); // "Orta" -> eski düzey 5
    expect(screen.queryByTestId('bot-game')).not.toBeInTheDocument();
  });
});

describe('OpeningPractice — initialVariantId/initialCriteria (doğrudan-başlat, /play sayfası)', () => {
  it('ikisi de verilirse seçim adımları ATLANIR, doğrudan o varyantla maç açılır', async () => {
    render(<OpeningPractice initialVariantId={11} initialCriteria={CRITERIA} />);
    await waitFor(() =>
      expect(screen.getByTestId('bot-game').getAttribute('data-start-fen')).toBe(FEN),
    );
    expect(screen.queryByRole('button', { name: /Bota Karşı Pratik Yap/ })).not.toBeInTheDocument();
  });

  it('yalnızca initialVariantId verilip initialCriteria eksikse normal akordiyon akışı çalışır', () => {
    render(<OpeningPractice initialVariantId={11} />);
    expect(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ })).toBeInTheDocument();
    expect(screen.queryByTestId('bot-game')).not.toBeInTheDocument();
  });

  it('id listede yoksa "Açılış bulunamadı" gösterir', async () => {
    render(<OpeningPractice initialVariantId={999} initialCriteria={CRITERIA} />);
    await waitFor(() => expect(screen.getByText('Açılış bulunamadı.')).toBeInTheDocument());
  });
});
