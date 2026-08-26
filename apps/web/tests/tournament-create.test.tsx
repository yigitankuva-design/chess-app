import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

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

import TournamentCreatePage from '@/app/(child)/play/tournament/create/page';

function mockFetchOnce(data: unknown, ok = true) {
  return { ok, json: async () => data } as Response;
}

describe('Turnuva Oluştur — /play/tournament/create', () => {
  beforeEach(() => { push.mockClear(); });

  it('admin varsayılanları baştan seçili gelir (60 dk, 10+0, Puanlı)', () => {
    render(<TournamentCreatePage />);
    expect(screen.getByRole('button', { name: '60 dk' }).style.border).toContain('2px solid');
    expect(screen.getByRole('button', { name: '10+0' }).style.border).toContain('2px solid');
    expect(screen.getByRole('button', { name: '🏆 Puanlı' }).style.border).toContain('2px solid');
  });

  it('ad girilmeden Oluştur butonu pasiftir', () => {
    render(<TournamentCreatePage />);
    expect(screen.getByRole('button', { name: /Turnuvayı Oluştur/ })).toBeDisabled();
  });

  it('İleride Başlat seçilince tarih alanı zorunlu olur', () => {
    render(<TournamentCreatePage />);
    fireEvent.change(screen.getByPlaceholderText(/Turnuva adı/), { target: { value: 'Test Turnuvası' } });
    fireEvent.click(screen.getByRole('button', { name: 'İleride Başlat' }));
    expect(screen.getByRole('button', { name: /Turnuvayı Oluştur/ })).toBeDisabled();
  });

  it('kriterler seçilip oluşturulunca POST /tournaments gönderir ve turnuva sayfasına yönlendirir', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockFetchOnce({ id: 42, name: 'Test Turnuvası' }));
    global.fetch = fetchMock;
    render(<TournamentCreatePage />);
    fireEvent.change(screen.getByPlaceholderText(/Turnuva adı/), { target: { value: 'Test Turnuvası' } });
    fireEvent.click(screen.getByRole('button', { name: '30 dk' }));
    fireEvent.click(screen.getByRole('button', { name: /Turnuvayı Oluştur/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const call = fetchMock.mock.calls[0];
    expect(call[0]).toContain('/tournaments');
    const body = JSON.parse(call[1].body as string);
    expect(body.name).toBe('Test Turnuvası');
    expect(body.duration_minutes).toBe(30);
    expect(body.rated).toBe(true);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/play/tournament/42'));
  });
});
