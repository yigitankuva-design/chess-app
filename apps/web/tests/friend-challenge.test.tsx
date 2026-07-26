import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const challenge = vi.fn();
let players: { child_id: number; display_name: string }[] = [];

vi.mock('@/lib/lobby/LobbyContext', () => ({
  useLobbyContext: () => ({
    players, offers: [], myOffer: null, notice: '', incoming: null,
    challenge, createOffer: vi.fn(), cancelOffer: vi.fn(), takeOffer: vi.fn(),
    acceptChallenge: vi.fn(), declineChallenge: vi.fn(),
  }),
}));

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import { FriendChallenge } from '@/components/play/FriendChallenge';

const ATHLETES = [
  { child_id: 1, display_name: 'Ayşe' },
  { child_id: 2, display_name: 'Ayhan' },
  { child_id: 3, display_name: 'Mehmet' },
];

beforeEach(() => {
  challenge.mockReset();
  players = [{ child_id: 1, display_name: 'Ayşe' }];  // yalnizca Ayse aktif
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ATHLETES })));
});

/** 1. karti onaylayip 2. karti acar ve isimlerin gelmesini bekler. */
async function pickCriteria() {
  fireEvent.click(screen.getByRole('button', { name: '5+0' }));
  fireEvent.click(screen.getByRole('button', { name: /Kriterleri Onayla/ }));
  await waitFor(() => expect(screen.getByText('Ayşe')).toBeInTheDocument());
}

describe('FriendChallenge', () => {
  it('KİLİT: kriterler onaylanmadan 2. kart açılmaz', () => {
    render(<FriendChallenge />);
    const btn = screen.getByRole('button', { name: /2\. Arkadaşını Seç/ });
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(btn);
    expect(screen.queryByPlaceholderText(/ARA/)).not.toBeInTheDocument();
  });

  it('kriterler onaylanınca 2. kart açılır ve isimler listelenir', async () => {
    render(<FriendChallenge />);
    await pickCriteria();
    expect(screen.getByText('Ayhan')).toBeInTheDocument();
    expect(screen.getByText('Mehmet')).toBeInTheDocument();
  });

  it('ARA kutusu harf harf süzer', async () => {
    render(<FriendChallenge />);
    await pickCriteria();
    fireEvent.change(screen.getByPlaceholderText(/ARA/), { target: { value: 'ayh' } });
    expect(screen.getByText('Ayhan')).toBeInTheDocument();
    expect(screen.queryByText('Mehmet')).not.toBeInTheDocument();
  });

  it('çevrimdışı isim seçilemez', async () => {
    render(<FriendChallenge />);
    await pickCriteria();
    const offline = screen.getByRole('button', { name: /Ayhan/ });
    expect(offline).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(offline);
    fireEvent.click(screen.getByRole('button', { name: /Teklif Et/ }));
    expect(challenge).not.toHaveBeenCalled();
  });

  it('aktif isme tıklanıp Teklif Et ile davet gönderilir', async () => {
    render(<FriendChallenge />);
    await pickCriteria();
    fireEvent.click(screen.getByRole('button', { name: /🟢 Ayşe/ }));
    fireEvent.click(screen.getByRole('button', { name: /Teklif Et/ }));
    expect(challenge).toHaveBeenCalledTimes(1);
    expect(challenge.mock.calls[0][0]).toBe(1);
    expect(screen.getByText(/Ayşe bekleniyor/)).toBeInTheDocument();
  });

  it('isim seçilmeden Teklif Et basılamaz', async () => {
    render(<FriendChallenge />);
    await pickCriteria();
    fireEvent.click(screen.getByRole('button', { name: /Teklif Et/ }));
    expect(challenge).not.toHaveBeenCalled();
  });

  it('liste yüklenemezse hata mesajı gösterilir', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    render(<FriendChallenge />);
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Kriterleri Onayla/ }));
    await waitFor(() =>
      expect(screen.getByText(/Sporcu listesi yüklenemedi/)).toBeInTheDocument(),
    );
  });
});
