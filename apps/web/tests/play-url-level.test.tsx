import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const search = { value: '' };
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search.value),
  useRouter: () => ({ push: vi.fn(), replace }),
}));
vi.mock('@/lib/settings/useTabGuard', () => ({ useTabGuard: () => {} }));
vi.mock('@/components/BotGame', () => ({ BotGame: () => <div data-testid="bot-game" /> }));
vi.mock('@/components/play/OfferBoard', () => ({ OfferBoard: () => <div /> }));
vi.mock('@/components/play/OpeningPractice', () => ({ OpeningPractice: () => <div /> }));

import PlayPage from '@/app/(child)/play/page';

beforeEach(() => {
  replace.mockClear();
  search.value = 'mode=bot';
});

describe('/play — adres düzey numarası taşır', () => {
  it('maç başlatınca adrese ham skill değil DÜZEY NUMARASI yazılır', async () => {
    render(<PlayPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Düzey 2' }));
    fireEvent.click(screen.getByRole('button', { name: '5+0' }));
    fireEvent.click(screen.getByRole('button', { name: /Maça Başla/ }));

    await waitFor(() => expect(replace).toHaveBeenCalled());
    const url = replace.mock.calls[0][0] as string;
    // Düzey 2'nin ham skill değeri 20; adreste 2 olmalı.
    expect(url).toContain('skill=2');
    expect(url).not.toContain('skill=20');
  });
});
