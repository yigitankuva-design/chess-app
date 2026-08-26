import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import TournamentLobbyPage from '@/app/(child)/play/tournament/lobby/page';

function mockFetchOnce(data: unknown, ok = true) {
  return { ok, json: async () => data } as Response;
}

describe('Turnuva Lobisi — /play/tournament/lobby', () => {
  beforeEach(() => { push.mockClear(); });

  it('liste boşsa bilgi mesajı gösterir', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([]));
    render(<TournamentLobbyPage />);
    await waitFor(() => expect(screen.getByText(/katılabileceğin bir turnuva yok/)).toBeInTheDocument());
  });

  it('turnuva listesi görünür, katılmadıysa "Katıl" düğmesi vardır', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([
      {
        id: 1, name: 'Yaz Turnuvası', starts_at: new Date().toISOString(), duration_minutes: 60,
        ends_at: new Date().toISOString(), seconds_remaining: 3000,
        base_ms: 300000, increment_ms: 2000, status: 'active', joined: false, rated: true, tempo: 'Yıldırım',
      },
    ]));
    render(<TournamentLobbyPage />);
    await waitFor(() => expect(screen.getByText('Yaz Turnuvası')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Katıl' })).toBeInTheDocument();
  });

  it('Katıl tıklanınca join isteği gönderilir ve turnuva sayfasına yönlendirir', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchOnce([
        {
          id: 1, name: 'Yaz Turnuvası', starts_at: new Date().toISOString(), duration_minutes: 60,
          ends_at: new Date().toISOString(), seconds_remaining: 3000,
          base_ms: null, increment_ms: null, status: 'active', joined: false, rated: false, tempo: null,
        },
      ]))
      .mockResolvedValueOnce(mockFetchOnce({ joined: true }));
    global.fetch = fetchMock;
    render(<TournamentLobbyPage />);
    await waitFor(() => screen.getByRole('button', { name: 'Katıl' }));
    fireEvent.click(screen.getByRole('button', { name: 'Katıl' }));
    await waitFor(() => expect(fetchMock.mock.calls[1][0]).toContain('/tournaments/1/join'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/play/tournament/1'));
  });

  it('zaten katılınmış turnuvada "Aç" düğmesi doğrudan turnuva sayfasına götürür', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([
      {
        id: 7, name: 'T7', starts_at: new Date().toISOString(), duration_minutes: 30,
        ends_at: new Date().toISOString(), seconds_remaining: 1000,
        base_ms: null, increment_ms: null, status: 'active', joined: true, rated: false, tempo: null,
      },
    ]));
    render(<TournamentLobbyPage />);
    await waitFor(() => screen.getByRole('button', { name: 'Aç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aç' }));
    expect(push).toHaveBeenCalledWith('/play/tournament/7');
  });

  it('bitmiş turnuvada katıl butonu yerine "Bitti" yazısı gösterilir', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([
      {
        id: 9, name: 'T9', starts_at: new Date().toISOString(), duration_minutes: 30,
        ends_at: new Date().toISOString(), seconds_remaining: 0,
        base_ms: null, increment_ms: null, status: 'finished', joined: false, rated: false, tempo: null,
      },
    ]));
    render(<TournamentLobbyPage />);
    await waitFor(() => expect(screen.getByText('Bitti')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Katıl' })).not.toBeInTheDocument();
  });
});
