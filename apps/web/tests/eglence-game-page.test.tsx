import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useParams: () => ({ game: '7' }),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('@/lib/settings/settings-context', () => ({
  useSettings: () => ({ settings: { tabs: { eglence: true } } }),
}));

import EglenceGamePage from '@/app/(child)/eglence/[game]/page';

describe('/eglence/[game] — admin verisinden id ile bulunur (madde: 2026-08-21)', () => {
  it('eşleşen aktivite bulununca isim/açıklama gösterilir', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: async () => [
        { id: 7, name: 'Koordinat Yarışı', description: 'Kareleri hızlıca bul', emoji: '🏁' },
      ],
    })) as never;
    render(<EglenceGamePage />);
    expect(await screen.findByText('Koordinat Yarışı')).toBeInTheDocument();
    expect(screen.getByText('Kareleri hızlıca bul')).toBeInTheDocument();
  });

  it('eşleşen aktivite yoksa genel "hazırlanıyor" gösterilir, çökmez', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] })) as never;
    render(<EglenceGamePage />);
    expect(await screen.findByText('Eğlence')).toBeInTheDocument();
    expect(screen.getByText('Bu içerik hazırlanıyor.')).toBeInTheDocument();
  });
});
