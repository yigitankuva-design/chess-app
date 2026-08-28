import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

vi.mock('@/lib/settings/settings-context', async () => {
  const { TIME_GROUPS } = await vi.importActual<typeof import('@/lib/play/levels')>('@/lib/play/levels');
  return {
    useSettings: () => ({
      settings: {
        play: {
          timeGroups: TIME_GROUPS,
          tournamentDefaults: { durationMinutes: 60, timeControlLabel: '10+0', rated: true },
        },
      },
    }),
  };
});

import TournamentLobbyPage from '@/app/(child)/play/tournament/lobby/page';

function mockFetchOnce(data: unknown, ok = true) {
  return { ok, json: async () => data } as Response;
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 1, name: 'Yaz Turnuvası',
    starts_at: '2026-09-07T15:45:00', duration_minutes: 120,
    ends_at: '2026-09-07T17:45:00', seconds_remaining: 3300,
    base_ms: 600000, increment_ms: 0, status: 'active', joined: false, rated: true, tempo: 'Hızlı',
    description: null, start_fen: null, winning_streak_bonus: true, participant_count: 5306,
    ...overrides,
  };
}

describe('Turnuva Lobisi — /play/tournament/lobby', () => {
  beforeEach(() => { push.mockClear(); });

  it('liste boşsa bilgi mesajı gösterir', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([]));
    render(<TournamentLobbyPage />);
    await waitFor(() => expect(screen.getByText(/katılabileceğin aktif bir turnuva yok/)).toBeInTheDocument());
  });

  it('7 sütun başlığı da render edilir', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([row()]));
    render(<TournamentLobbyPage />);
    await waitFor(() => screen.getByText('Yaz Turnuvası'));
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual([
      'Saat', 'Turnuva İsmi', 'Tempo', 'Toplam Süre', 'Kalan Süre', 'Katılımcı Sayısı', 'Katılım İsteği',
    ]);
  });

  it('saat "15:45" formatında gösterilir (madde 1)', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([row({ starts_at: '2026-09-07T15:45:00' })]));
    render(<TournamentLobbyPage />);
    await waitFor(() => expect(screen.getByText('15:45')).toBeInTheDocument());
  });

  it('sadece AKTİF turnuvalar listelenir — upcoming/finished görünmez', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([
      row({ id: 1, name: 'Aktif Olan', status: 'active' }),
      row({ id: 2, name: 'Henüz Başlamadı', status: 'upcoming' }),
      row({ id: 3, name: 'Bitmiş Olan', status: 'finished' }),
    ]));
    render(<TournamentLobbyPage />);
    await waitFor(() => expect(screen.getByText('Aktif Olan')).toBeInTheDocument());
    expect(screen.queryByText('Henüz Başlamadı')).not.toBeInTheDocument();
    expect(screen.queryByText('Bitmiş Olan')).not.toBeInTheDocument();
  });

  it('katılımcı sayısı gösterilir', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([row({ participant_count: 5306 })]));
    render(<TournamentLobbyPage />);
    await waitFor(() => expect(screen.getByText('5306')).toBeInTheDocument());
  });

  it('Katıl tıklanınca join isteği gönderilir ve turnuva sayfasına yönlendirir', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockFetchOnce([row({ id: 1, joined: false })]))
      .mockResolvedValueOnce(mockFetchOnce({ joined: true }));
    global.fetch = fetchMock;
    render(<TournamentLobbyPage />);
    await waitFor(() => screen.getByRole('button', { name: 'Katıl' }));
    fireEvent.click(screen.getByRole('button', { name: 'Katıl' }));
    await waitFor(() => expect(fetchMock.mock.calls[1][0]).toContain('/tournaments/1/join'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/play/tournament/1'));
  });

  it('zaten katılınmış turnuvada "Aç" düğmesi doğrudan turnuva sayfasına götürür', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([row({ id: 7, joined: true })]));
    render(<TournamentLobbyPage />);
    await waitFor(() => screen.getByRole('button', { name: 'Aç' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aç' }));
    expect(push).toHaveBeenCalledWith('/play/tournament/7');
  });

  it('Ara kutusuna yazınca isim filtrelenir', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([
      row({ id: 1, name: 'Yaz Turnuvası' }),
      row({ id: 2, name: 'Kış Kupası' }),
    ]));
    render(<TournamentLobbyPage />);
    await waitFor(() => screen.getByText('Yaz Turnuvası'));
    fireEvent.change(screen.getByPlaceholderText('Ara'), { target: { value: 'kış' } });
    expect(screen.queryByText('Yaz Turnuvası')).not.toBeInTheDocument();
    expect(screen.getByText('Kış Kupası')).toBeInTheDocument();
  });

  it('Tempo kutusu filtre görevi görür (madde 3): seçilen tempoya uymayanlar gizlenir', async () => {
    global.fetch = vi.fn().mockResolvedValue(mockFetchOnce([
      row({ id: 1, name: 'Hızlı Turnuva', tempo: 'Hızlı' }),
      row({ id: 2, name: 'Yıldırım Turnuva', tempo: 'Yıldırım' }),
    ]));
    render(<TournamentLobbyPage />);
    await waitFor(() => screen.getByText('Hızlı Turnuva'));
    fireEvent.change(screen.getByLabelText('Tempo'), { target: { value: 'Yıldırım' } });
    expect(screen.queryByText('Hızlı Turnuva')).not.toBeInTheDocument();
    expect(screen.getByText('Yıldırım Turnuva')).toBeInTheDocument();
  });
});
