import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const challenge = vi.fn();

vi.mock('@/lib/lobby/LobbyContext', () => ({
  useLobbyContext: () => ({ players: [{ child_id: 7 }], challenge }),
}));

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

vi.mock('@/components/BotGame', () => ({ BotGame: () => <div data-testid="bot-game" /> }));

const ITALYAN_FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 1';
const OPENINGS = [
  {
    id: 1, name: "e4'lü Açılışlar",
    openings: [{ id: 1, name: 'İtalyan Açılışı', variants: [{ id: 11, name: 'Ana Hat', start_fen: ITALYAN_FEN }] }],
  },
  {
    id: 2, name: "d4'lü Açılışlar",
    openings: [{ id: 2, name: 'Slav Savunması', variants: [{ id: 21, name: 'Ana Hat', start_fen: ITALYAN_FEN }] }],
  },
  { id: 3, name: 'Diğer Açılışlar', openings: [] },
];
const ATHLETES = [{ child_id: 7, display_name: 'Hasan Yiğit' }];

beforeEach(() => {
  challenge.mockClear();
  vi.stubGlobal('fetch', vi.fn((url: string) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(String(url).includes('/openings') ? OPENINGS : ATHLETES),
    }),
  ) as unknown as typeof fetch);
});

import { OpeningPractice } from '@/components/play/OpeningPractice';

/** "c) Açılış Konumunu İlerlet" alt sekmesini açar — Bota Karşı/Arkadaşına
 *  Karşı kartları ARTIK bunun İÇİNDE (madde 2026-09-02: a/b/c iskeleti). */
function openUygulama() {
  fireEvent.click(screen.getByText('c) Açılış Konumunu İlerlet'));
}

describe('Açılış Pratiği — arkadaşa karşı 3 adım (madde: 2026-08-20, güncelleme — iç içe akordiyon)', () => {
  it('adımlar 1) Açılış Seç 2) Maç Kriterlerini Belirle 3) Arkadaşını Seç sırasındadır', () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));

    expect(screen.getByText('1. Açılış Seç')).toBeInTheDocument();
    expect(screen.getByText('2. Maç Kriterlerini Belirle')).toBeInTheDocument();
    expect(screen.getByText('3. Arkadaşını Seç')).toBeInTheDocument();
  });

  it('TUZAK: açılış seçilmeden kriter adımı KİLİTLİDİR', () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));
    expect(screen.getByText('2. Maç Kriterlerini Belirle').closest('button'))
      .toHaveAttribute('aria-disabled', 'true');
  });

  it('liste başta gizlidir; tür seçilince o türün açılış İSİMLERİ İÇİNDE görünür', async () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));
    expect(screen.queryByText('İtalyan Açılışı')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('1. Açılış Seç'));
    fireEvent.click(await screen.findByText("e4'lü Açılışlar"));

    await waitFor(() => screen.getByText('İtalyan Açılışı'));
    // Baska turdeki acilis bu listede GORUNMEZ.
    expect(screen.queryByText('Slav Savunması')).not.toBeInTheDocument();
  });

  it('açılış ismi seçilince o açılışın VARYANTLARI İÇİNDE görünür', async () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));
    fireEvent.click(screen.getByText('1. Açılış Seç'));
    fireEvent.click(await screen.findByText("e4'lü Açılışlar"));
    fireEvent.click(await screen.findByText('İtalyan Açılışı'));
    await waitFor(() => expect(screen.getByText('Ana Hat')).toBeInTheDocument());
  });

  it('seçilen VARYANTIN start_fen değeri teklifle birlikte gider', async () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));
    fireEvent.click(screen.getByText('1. Açılış Seç'));
    fireEvent.click(await screen.findByText("e4'lü Açılışlar"));
    fireEvent.click(await screen.findByText('İtalyan Açılışı'));
    fireEvent.click(await screen.findByText('Ana Hat'));

    fireEvent.click(screen.getByRole('button', { name: '10+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Kriterleri Onayla/ }));

    await waitFor(() => screen.getByText('Hasan Yiğit'));
    fireEvent.click(screen.getByText('Hasan Yiğit'));
    fireEvent.click(screen.getByRole('button', { name: /Teklif Et/ }));

    expect(challenge).toHaveBeenCalledTimes(1);
    expect(challenge.mock.calls[0][1].start_fen).toBe(ITALYAN_FEN);
  });
});

describe('Açılış Pratiği — bota karşı 3 adım (madde: 2026-08-20, güncelleme; 2026-09-06 üçüncü tur)', () => {
  it('adımlar 1) Açılış Seç 2) Renk Seç 3) İlerleme Sınırı Belirle sırasındadır', () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    expect(screen.getByText('1. Açılış Seç')).toBeInTheDocument();
    expect(screen.getByText('2. Renk Seç')).toBeInTheDocument();
    expect(screen.getByText('3. İlerleme Sınırı Belirle')).toBeInTheDocument();
  });

  it('liste başta gizlidir', () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    expect(screen.queryByText('İtalyan Açılışı')).not.toBeInTheDocument();
  });

  it('TUZAK: farklı bir varyant seçilince önceki seçim değişir, renk kilidi güncel varyanta göre kalır', async () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    fireEvent.click(screen.getByText('1. Açılış Seç'));
    fireEvent.click(await screen.findByText("e4'lü Açılışlar"));
    fireEvent.click(await screen.findByText('İtalyan Açılışı'));
    fireEvent.click(await screen.findByText('Ana Hat'));
    expect(screen.getByText('2. Renk Seç').closest('button'))
      .toHaveAttribute('aria-disabled', 'false');
  });

  it('boş türde bilgi mesajı gösterir', async () => {
    render(<OpeningPractice />);
    openUygulama();
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    fireEvent.click(screen.getByText('1. Açılış Seç'));
    fireEvent.click(await screen.findByText('Diğer Açılışlar'));
    await waitFor(() => screen.getByText('Bu türde henüz açılış yok.'));
  });
});

describe('FriendChallenge — açılış adımı VERİLMEZSE çizilmez', () => {
  it('Arkadaşla Oyna akışında açılış adımı yoktur, kriter kilitli değildir', async () => {
    const { FriendChallenge } = await import('@/components/play/FriendChallenge');
    render(<FriendChallenge />);
    expect(screen.queryByText(/Açılış Seç/)).not.toBeInTheDocument();
    expect(screen.getByText('1. Maç Kriterlerini Belirle').closest('button'))
      .toHaveAttribute('aria-disabled', 'false');
  });
});
