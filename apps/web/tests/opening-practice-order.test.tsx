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
  { id: 1, name: 'İtalyan Açılışı', start_fen: ITALYAN_FEN, category: 'e4' },
  { id: 2, name: 'Slav Savunması', start_fen: ITALYAN_FEN, category: 'd4' },
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

describe('Açılış Pratiği — arkadaşa karşı 4 adım', () => {
  it('adımlar 1) Tür 2) Açılış 3) Kriterler 4) Arkadaş sırasındadır', () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));

    // StepCard basligi "N. Baslik" olarak tek parca cizilir.
    expect(screen.getByText('1. Açılış Türünü Seç')).toBeInTheDocument();
    expect(screen.getByText('2. Açılış Konumunu Seç')).toBeInTheDocument();
    expect(screen.getByText('3. Maç Kriterlerini Belirle')).toBeInTheDocument();
    expect(screen.getByText('4. Arkadaşını Seç')).toBeInTheDocument();
  });

  it('TUZAK: tür seçilmeden açılış adımı KİLİTLİDİR', () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));
    expect(screen.getByText('2. Açılış Konumunu Seç').closest('button'))
      .toHaveAttribute('aria-disabled', 'true');
  });

  it('TUZAK: açılış seçilmeden kriter adımı KİLİTLİDİR', () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));
    expect(screen.getByText('3. Maç Kriterlerini Belirle').closest('button'))
      .toHaveAttribute('aria-disabled', 'true');
  });

  it('liste başta gizlidir; tür seçilince o türün açılışları görünür', async () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));
    expect(screen.queryByText('İtalyan Açılışı')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('1. Açılış Türünü Seç'));
    fireEvent.click(await screen.findByText('e4 ile Başlayanlar'));

    await waitFor(() => screen.getByText('İtalyan Açılışı'));
    // Baska turdeki acilis bu listede GORUNMEZ.
    expect(screen.queryByText('Slav Savunması')).not.toBeInTheDocument();
  });

  it('seçilen açılışın start_fen değeri teklifle birlikte gider', async () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByText('Arkadaşına Karşı Pratik Yap'));
    fireEvent.click(screen.getByText('1. Açılış Türünü Seç'));
    fireEvent.click(await screen.findByText('e4 ile Başlayanlar'));

    fireEvent.click(await screen.findByText('İtalyan Açılışı'));

    fireEvent.click(screen.getByRole('button', { name: '10+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Kriterleri Onayla/ }));

    await waitFor(() => screen.getByText('Hasan Yiğit'));
    fireEvent.click(screen.getByText('Hasan Yiğit'));
    fireEvent.click(screen.getByRole('button', { name: /Teklif Et/ }));

    expect(challenge).toHaveBeenCalledTimes(1);
    expect(challenge.mock.calls[0][1].start_fen).toBe(ITALYAN_FEN);
  });
});

describe('Açılış Pratiği — bota karşı 3 adım', () => {
  it('adımlar 1) Tür 2) Açılış 3) Kriter sırasındadır', () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    expect(screen.getByText('1. Açılış Türünü Seç')).toBeInTheDocument();
    expect(screen.getByText('2. Açılış Konumunu Seç')).toBeInTheDocument();
    expect(screen.getByText('3. Maç Kriterlerini Seç')).toBeInTheDocument();
  });

  it('liste başta gizlidir', () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    expect(screen.queryByText('İtalyan Açılışı')).not.toBeInTheDocument();
  });

  it('TUZAK: tür değişince seçili açılış sıfırlanır, kriter yeniden kilitlenir', async () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    fireEvent.click(screen.getByText('1. Açılış Türünü Seç'));
    fireEvent.click(await screen.findByText('e4 ile Başlayanlar'));
    fireEvent.click(await screen.findByText('İtalyan Açılışı'));
    expect(screen.getByText('3. Maç Kriterlerini Seç').closest('button'))
      .toHaveAttribute('aria-disabled', 'false');

    fireEvent.click(screen.getByText('1. Açılış Türünü Seç'));
    fireEvent.click(await screen.findByText('d4 ile Başlayanlar'));
    expect(screen.getByText('3. Maç Kriterlerini Seç').closest('button'))
      .toHaveAttribute('aria-disabled', 'true');
  });

  it('boş türde bilgi mesajı gösterir', async () => {
    render(<OpeningPractice />);
    fireEvent.click(screen.getByText('Bota Karşı Pratik Yap'));
    fireEvent.click(screen.getByText('1. Açılış Türünü Seç'));
    fireEvent.click(await screen.findByText('Diğerleri'));
    await waitFor(() => screen.getByText('Bu türde henüz açılış yok.'));
  });
});

describe('FriendChallenge — açılış adımı VERİLMEZSE çizilmez', () => {
  it('Arkadaşla Oyna akışında açılış adımı yoktur, kriter kilitli değildir', async () => {
    const { FriendChallenge } = await import('@/components/play/FriendChallenge');
    render(<FriendChallenge />);
    expect(screen.queryByText(/Açılış Konumunu Seç/)).not.toBeInTheDocument();
    expect(screen.getByText('1. Maç Kriterlerini Belirle').closest('button'))
      .toHaveAttribute('aria-disabled', 'false');
  });
});
