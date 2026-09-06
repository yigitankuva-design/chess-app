import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { Suspense } from 'react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/LessonPlayer', () => ({
  LessonPlayer: ({ onComplete }: { onComplete: () => void }) => (
    <button type="button" onClick={onComplete}>Tamamla</button>
  ),
}));

const logActivityTime = vi.fn();
vi.mock('@/lib/activity/activityApi', () => ({
  logActivityTime: (...args: unknown[]) => logActivityTime(...args),
}));

import LessonPage from '@/app/(child)/lesson/[id]/page';

const LESSON = { id: 5, module_id: 1, title: 'Test Ders', estimated_minutes: 8, steps: [] };

beforeEach(() => {
  logActivityTime.mockReset();
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(LESSON) })
  ) as unknown as typeof fetch);
});

describe('Ders sayfası — Sporcu Profili "Bu Hafta" Dersler süresi (madde 2026-09-06)', () => {
  it('ders tamamlanınca logActivityTime(\'lessons\', süre) çağrılır', async () => {
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <LessonPage params={Promise.resolve({ id: '5' })} />
        </Suspense>,
      );
    });
    await waitFor(() => screen.getByText('Tamamla'));
    fireEvent.click(screen.getByText('Tamamla'));

    await waitFor(() => expect(logActivityTime).toHaveBeenCalledWith('lessons', expect.any(Number)));
  });
});
