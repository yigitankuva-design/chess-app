import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

let wsHandler: ((d: unknown) => void) | null = null;
let lastWsUrl: string | null = null;
vi.mock('@/lib/hooks/use-websocket', () => ({
  useWebSocket: (url: string | null, onMessage: (d: unknown) => void) => {
    lastWsUrl = url;
    wsHandler = url ? onMessage : null;
    return { send: vi.fn(), readyState: url ? 1 : 3 };
  },
  wsBase: () => 'ws://test',
}));

import { TournamentDetailView } from '@/app/(child)/play/tournament/[id]/page';

function mockFetchOnce(data: unknown, ok = true) {
  return { ok, json: async () => data } as Response;
}

function baseDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, name: 'Yaz Turnuvası',
    starts_at: new Date().toISOString(), duration_minutes: 60,
    ends_at: new Date().toISOString(), seconds_remaining: 1800,
    base_ms: 300000, increment_ms: 0, status: 'active', joined: true, rated: false, tempo: null,
    standings: [{ child_id: 1, display_name: 'Ali', score: 4, sb: 2.5, streak: 2, rating: null, title: null }],
    my_pairing: null,
    recent_pairings: [],
    ...overrides,
  };
}

async function renderPage(detail: unknown) {
  global.fetch = vi.fn().mockResolvedValue(mockFetchOnce(detail));
  const utils = render(<TournamentDetailView tournamentId={1} />);
  await waitFor(() => expect(screen.queryByText('Yükleniyor...')).not.toBeInTheDocument());
  return utils;
}

describe('Canlı turnuva sayfası — /play/tournament/[id]', () => {
  beforeEach(() => { push.mockClear(); wsHandler = null; lastWsUrl = null; });

  it('katılmamış sporcuya "Turnuvaya Katıl" butonu gösterir, kuyruğa bağlanmaz', async () => {
    await renderPage(baseDetail({ joined: false }));
    expect(screen.getByRole('button', { name: 'Turnuvaya Katıl' })).toBeInTheDocument();
    expect(lastWsUrl).toBeNull();
  });

  it('katılmış ve aktif ama eşleşmesi yoksa kuyruğa bağlanır ("Rakip aranıyor")', async () => {
    await renderPage(baseDetail({ joined: true, my_pairing: null }));
    expect(lastWsUrl).toContain('/ws/tournament/1/queue');
    expect(screen.getByText(/Rakip aranıyor/)).toBeInTheDocument();
  });

  it('WS "matched" mesajı gelince /play/online/{gameId}\'e yönlendirir', async () => {
    await renderPage(baseDetail({ joined: true, my_pairing: null }));
    act(() => wsHandler!({ type: 'matched', game_id: 55, color: 'black' }));
    expect(push).toHaveBeenCalledWith('/play/online/55?color=black');
  });

  it('zaten aktif bir eşleşmesi varsa kuyruğa GİRMEZ, "Maça Devam Et" gösterir', async () => {
    await renderPage(baseDetail({
      joined: true,
      my_pairing: { id: 9, opponent_id: 2, opponent_name: 'Ayşe', my_color: 'white', game_id: 77 },
    }));
    expect(lastWsUrl).toBeNull();
    expect(screen.getByText(/Ayşe/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Maça Devam Et' }));
    expect(push).toHaveBeenCalledWith('/play/online/77?color=white');
  });

  it('sıralamada 2+ galibiyet serisi 🔥 ile gösterilir', async () => {
    await renderPage(baseDetail());
    expect(screen.getByText(/🔥/)).toBeInTheDocument();
  });

  it('turnuva silinince lobiye yönlendirir', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchOnce(baseDetail()))
      .mockResolvedValueOnce(mockFetchOnce({ deleted: true }));
    global.fetch = fetchMock;
    render(<TournamentDetailView tournamentId={1} />);
    await waitFor(() => screen.getByRole('button', { name: 'Turnuvayı Sil' }));
    fireEvent.click(screen.getByRole('button', { name: 'Turnuvayı Sil' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/play/tournament/lobby'));
  });
});
