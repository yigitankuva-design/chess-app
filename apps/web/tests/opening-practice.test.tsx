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
    id: 1, name: "e4'lü Açılışlar",
    openings: [{
      id: 1, name: 'İtalyan Açılışı',
      variants: [{ id: 11, name: 'Klasik Varyant', start_fen: FEN }],
    }],
  }];
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => openingsFixture(),
  })));
});

/** "c) Uygulama Pratiği" alt sekmesini açar — Bota Karşı/Arkadaşına Karşı
 *  kartları ARTIK bunun İÇİNDE (madde 2026-09-02: a/b/c iskeleti, Zafer'in
 *  şemasına göre — a/b'nin işlevi ayrı bir işte gelecek, burada sadece
 *  gezinme katmanı testlere eklendi). */
function openUygulama() {
  fireEvent.click(screen.getByRole('button', { name: /c\) Uygulama Pratiği/ }));
}

/** Bot kartini acar, "1. Açılış Seç" akordiyonunda Tür -> Açılış -> Varyant
 *  ic ice acip son varyanti secer (madde: 2026-08-20, guncelleme). */
async function pickVariant() {
  openUygulama();
  fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
  fireEvent.click(screen.getByRole('button', { name: /1\. Açılış Seç/ }));
  fireEvent.click(await screen.findByText("e4'lü Açılışlar"));
  await waitFor(() => expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument());
  fireEvent.click(screen.getByText('İtalyan Açılışı'));
  await waitFor(() => expect(screen.getByText('Klasik Varyant')).toBeInTheDocument());
  fireEvent.click(screen.getByText('Klasik Varyant'));
}

async function pickVariantAndStartCriteria() {
  await pickVariant();
  fireEvent.click(screen.getByRole('button', { name: 'Orta' }));
  fireEvent.click(screen.getByRole('button', { name: '5+0' }));
}

describe('OpeningPractice — iç içe akordiyon (madde: 2026-08-20, güncelleme)', () => {
  it('başlangıçta "c) Uygulama Pratiği" kapalıdır, iki iç kart DOM\'da yok', () => {
    render(<OpeningPractice />);
    expect(screen.getByRole('button', { name: /c\) Uygulama Pratiği/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bota Karşı Pratik Yap/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Arkadaşına Karşı Pratik Yap/ })).not.toBeInTheDocument();
  });

  it('"c) Uygulama Pratiği" açılınca iki dış kart görünür, ikisi de kapalıdır', () => {
    render(<OpeningPractice />);
    openUygulama();
    expect(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Arkadaşına Karşı Pratik Yap/ })).toBeInTheDocument();
    // Govdeler kapali: ic kartlarin basliklari DOM'da yok
    expect(screen.queryByText('1. Açılış Seç')).not.toBeInTheDocument();
    expect(screen.queryByTestId('friend-challenge')).not.toBeInTheDocument();
  });

  it('bot kartı açılınca İKİ kart görünür (Açılış Seç, Maç Kriterlerini Seç)', async () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    expect(screen.getByText('1. Açılış Seç')).toBeInTheDocument();
    expect(screen.getByText('2. Maç Kriterlerini Seç')).toBeInTheDocument();
  });

  it('KİLİT: varyant seçilmeden kriter kartı açılmaz', async () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    const criteriaBtn = screen.getByRole('button', { name: /2\. Maç Kriterlerini Seç/ });
    expect(criteriaBtn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(criteriaBtn);
    expect(screen.queryByRole('button', { name: 'Kolay' })).not.toBeInTheDocument();
  });

  it('tür seçilince açılış isimleri İÇİNDE genişler (sayfa değişmez, akordiyon kapanmaz)', async () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    fireEvent.click(screen.getByRole('button', { name: /1\. Açılış Seç/ }));
    fireEvent.click(await screen.findByText("e4'lü Açılışlar"));
    // Tür satırı hala DOM'da (kapanmadı) — açılış onun İÇİNDE göründü.
    expect(screen.getByText("e4'lü Açılışlar")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('İtalyan Açılışı')).toBeInTheDocument());
  });

  it('varyant seçilince "1. Açılış Seç" özeti çıkar, 2. kart kendiliğinden açılır', async () => {
    render(<OpeningPractice />);
    await pickVariant();
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

  it('practiceActions "farklı konum": AYNI türdeki BAŞKA bir varyantı seçer', async () => {
    const FEN2 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => [{
        id: 1, name: "e4'lü Açılışlar",
        openings: [{
          id: 1, name: 'İtalyan Açılışı',
          variants: [
            { id: 11, name: 'Klasik Varyant', start_fen: FEN },
            { id: 12, name: 'Giuoco Piano', start_fen: FEN2 },
          ],
        }],
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
    openUygulama();
    fireEvent.click(screen.getByRole('button', { name: /Arkadaşına Karşı Pratik Yap/ }));
    expect(screen.getByTestId('friend-challenge')).toBeInTheDocument();
  });

  it('dış akordiyon tek-açık: arkadaş açılınca bot kapanır', async () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    fireEvent.click(screen.getByRole('button', { name: /Arkadaşına Karşı Pratik Yap/ }));
    expect(screen.queryByText('1. Açılış Seç')).not.toBeInTheDocument();
    expect(screen.getByTestId('friend-challenge')).toBeInTheDocument();
  });

  it('REGRESYON: açılış türü listesi boşsa bilgi mesajı gösterilir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    fireEvent.click(screen.getByRole('button', { name: /1\. Açılış Seç/ }));
    await waitFor(() =>
      expect(screen.getByText(/Henüz açılış türü yok/i)).toBeInTheDocument(),
    );
  });

  it('açılışın hiç varyantı yoksa bilgi mesajı gösterilir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => [{
        id: 1, name: "e4'lü Açılışlar",
        openings: [{ id: 1, name: 'Varyantsız', variants: [] }],
      }],
    })));
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ }));
    fireEvent.click(screen.getByRole('button', { name: /1\. Açılış Seç/ }));
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
    openUygulama();
    expect(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ })).toBeInTheDocument();
    expect(screen.queryByTestId('bot-game')).not.toBeInTheDocument();
  });

  it('id listede yoksa "Açılış bulunamadı" gösterir', async () => {
    render(<OpeningPractice initialVariantId={999} initialCriteria={CRITERIA} />);
    await waitFor(() => expect(screen.getByText('Açılış bulunamadı.')).toBeInTheDocument());
  });
});

describe('OpeningPractice — etiket renkleri (madde 2026-09-02: açık temada beyaz-üstünde-beyaz düzeltmesi)', () => {
  it('dış kart etiketleri var(--t-text-1) kullanır, sabit "#fff" DEĞİL', () => {
    render(<OpeningPractice />);
    openUygulama();
    expect(screen.getByText('Bota Karşı Pratik Yap').style.color).toBe('var(--t-text-1)');
    expect(screen.getByText('Arkadaşına Karşı Pratik Yap').style.color).toBe('var(--t-text-1)');
  });

  it('bot dalı açılınca iç adım etiketleri de var(--t-text-1) kullanır', () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    expect(screen.getByText('1. Açılış Seç').style.color).toBe('var(--t-text-1)');
  });
});

describe('OpeningPractice — a) Konum Pratiği / b) Teori Pratiği (madde devam: ara ekran YOK, direkt navigasyon)', () => {
  it('a) tıklanınca HİÇBİR ara ekran açılmadan doğrudan onOpenKonumPratigi çağrılır', () => {
    const onOpen = vi.fn();
    render(<OpeningPractice onOpenKonumPratigi={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /a\) Konum Pratiği/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Pratiğe Başla' })).not.toBeInTheDocument();
    expect(screen.queryByText('Yükleniyor...')).not.toBeInTheDocument();
  });

  it('b) tıklanınca HİÇBİR ara ekran açılmadan doğrudan onOpenTeoriPratigi çağrılır', () => {
    const onOpen = vi.fn();
    render(<OpeningPractice onOpenTeoriPratigi={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /b\) Teori Pratiği/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Pratiğe Başla' })).not.toBeInTheDocument();
  });

  it('onOpenKonumPratigi/onOpenTeoriPratigi verilmezse tıklama hata vermez (no-op)', () => {
    render(<OpeningPractice />);
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: /a\) Konum Pratiği/ }));
      fireEvent.click(screen.getByRole('button', { name: /b\) Teori Pratiği/ }));
    }).not.toThrow();
  });

  it('a)/b) tıklanınca c) Uygulama Pratiği\'nin akordiyon durumunu ETKİLEMEZ', () => {
    render(<OpeningPractice onOpenKonumPratigi={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /c\) Uygulama Pratiği/ }));
    expect(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /a\) Konum Pratiği/ }));
    // c) hâlâ açık kalmalı — a) artık akordiyonu KAPATMIYOR, sadece navigasyon tetikliyor.
    expect(screen.getByRole('button', { name: /Bota Karşı Pratik Yap/ })).toBeInTheDocument();
  });
});
