import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import { TournamentPlay } from '@/components/play/TournamentPlay';

function mockFetchOnce(data: unknown, ok = true) {
  return { ok, json: async () => data } as Response;
}

describe('TournamentPlay — sporcu tarafı', () => {
  beforeEach(() => { push.mockReset(); });

  it('liste boşsa bilgi mesajı gösterir', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([]));
    render(<TournamentPlay />);
    await waitFor(() => expect(screen.getByText(/katılabileceğin bir turnuva yok/)).toBeInTheDocument());
  });

  it('turnuva listesi görünür, katılmadıysa "Katıl" düğmesi vardır', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([
      { id: 1, name: 'Yaz Turnuvası', rounds_total: 3, base_ms: 300000, increment_ms: 2000, status: 'upcoming', current_round: null, joined: false },
    ]));
    render(<TournamentPlay />);
    await waitFor(() => expect(screen.getByText('Yaz Turnuvası')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Katıl' })).toBeInTheDocument();
  });

  it('Katıl tıklanınca join isteği gönderilir ve detay açılır', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchOnce([
        { id: 1, name: 'Yaz Turnuvası', rounds_total: 3, base_ms: null, increment_ms: null, status: 'upcoming', current_round: null, joined: false },
      ]))
      .mockResolvedValueOnce(mockFetchOnce({ joined: true }))
      .mockResolvedValueOnce(mockFetchOnce([
        { id: 1, name: 'Yaz Turnuvası', rounds_total: 3, base_ms: null, increment_ms: null, status: 'upcoming', current_round: null, joined: true },
      ]))
      .mockResolvedValueOnce(mockFetchOnce({
        id: 1, name: 'Yaz Turnuvası', rounds_total: 3, base_ms: null, increment_ms: null,
        status: 'upcoming', current_round: null, standings: [], my_pairing: null,
      }));
    global.fetch = fetchMock;
    render(<TournamentPlay />);
    await waitFor(() => screen.getByRole('button', { name: 'Katıl' }));
    fireEvent.click(screen.getByRole('button', { name: 'Katıl' }));
    await waitFor(() => expect(fetchMock.mock.calls[1][0]).toContain('/tournaments/1/join'));
    await waitFor(() => expect(screen.getByText('← Turnuva listesine dön')).toBeInTheDocument());
  });

  it('aktif turdaki eşleşme ve "Maça Başla" gösterilir, tıklanınca yönlendirir', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchOnce([
        { id: 5, name: 'T5', rounds_total: 2, base_ms: null, increment_ms: null, status: 'active', current_round: 1, joined: true },
      ]))
      .mockResolvedValueOnce(mockFetchOnce({
        id: 5, name: 'T5', rounds_total: 2, base_ms: null, increment_ms: null, status: 'active', current_round: 1,
        standings: [{ child_id: 1, display_name: 'Ali', score: 0 }],
        my_pairing: {
          id: 10, round_number: 1, is_bye: false, opponent_name: 'Ayşe',
          my_color: 'white', game_id: null, result: null,
        },
      }))
      .mockResolvedValueOnce(mockFetchOnce({ game_id: 99, color: 'white' }));
    global.fetch = fetchMock;
    render(<TournamentPlay />);
    await waitFor(() => screen.getByRole('button', { name: 'Aç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aç' }));
    await waitFor(() => expect(screen.getByText(/Ayşe/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Maça Başla' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/play/online/99?color=white'));
  });

  it('bay geçilen eşleşmede maça başla düğmesi YOKTUR', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchOnce([
        { id: 6, name: 'T6', rounds_total: 1, base_ms: null, increment_ms: null, status: 'active', current_round: 1, joined: true },
      ]))
      .mockResolvedValueOnce(mockFetchOnce({
        id: 6, name: 'T6', rounds_total: 1, base_ms: null, increment_ms: null, status: 'active', current_round: 1,
        standings: [],
        my_pairing: { id: 11, round_number: 1, is_bye: true, opponent_name: null, my_color: 'white', game_id: null, result: 'bye' },
      }));
    global.fetch = fetchMock;
    render(<TournamentPlay />);
    await waitFor(() => screen.getByRole('button', { name: 'Aç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aç' }));
    await waitFor(() => expect(screen.getByText(/bay geçtin/)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Maça Başla' })).not.toBeInTheDocument();
  });
});
