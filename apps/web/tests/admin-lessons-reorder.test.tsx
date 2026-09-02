import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '1' }),
  useRouter: () => ({ back: vi.fn() }),
}));

import AdminModuleLessonsPage from '@/app/admin/content/[id]/page';

const LESSONS = [
  { id: 7, module_id: 1, order_index: 1, title: 'Piyon Hareketleri', estimated_minutes: 10, published: true, step_count: 2 },
  { id: 8, module_id: 1, order_index: 2, title: 'At Hareketleri', estimated_minutes: 12, published: true, step_count: 3 },
  { id: 9, module_id: 1, order_index: 3, title: 'Fil Hareketleri', estimated_minutes: 8, published: false, step_count: 1 },
];
const MODULES = [{ id: 1, order_index: 1, name: 'Temel Düzey', lesson_count: 3 }];

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
    if (opts?.method === 'POST' && url.includes('/reorder')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ reordered: 3 }) });
    }
    if (url.includes('/lessons')) return Promise.resolve({ ok: true, json: () => Promise.resolve(LESSONS) });
    return Promise.resolve({ ok: true, json: () => Promise.resolve(MODULES) });
  }) as unknown as typeof fetch);
}

describe('Admin dersler sayfası — Yukarı/Aşağı ile aynı düzey içinde sıralama', () => {
  beforeEach(stubFetch);

  it('ilk dersin "yukarı", son dersin "aşağı" düğmesi pasiftir; aradakiler aktiftir', async () => {
    render(<AdminModuleLessonsPage />);
    await waitFor(() => screen.getByText('Piyon Hareketleri'));

    expect(screen.getByLabelText('Piyon Hareketleri dersini yukarı taşı')).toBeDisabled();
    expect(screen.getByLabelText('Piyon Hareketleri dersini aşağı taşı')).not.toBeDisabled();

    expect(screen.getByLabelText('At Hareketleri dersini yukarı taşı')).not.toBeDisabled();
    expect(screen.getByLabelText('At Hareketleri dersini aşağı taşı')).not.toBeDisabled();

    expect(screen.getByLabelText('Fil Hareketleri dersini yukarı taşı')).not.toBeDisabled();
    expect(screen.getByLabelText('Fil Hareketleri dersini aşağı taşı')).toBeDisabled();
  });

  it('bir dersi "aşağı" taşıyınca yeni TAM sırayı /reorder\'a gönderir', async () => {
    render(<AdminModuleLessonsPage />);
    await waitFor(() => screen.getByText('Piyon Hareketleri'));

    fireEvent.click(screen.getByLabelText('Piyon Hareketleri dersini aşağı taşı'));

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const reorderCall = calls.find((c: unknown[]) => (c[0] as string).includes('/reorder'));
      expect(reorderCall).toBeTruthy();
      expect(reorderCall![0]).toBe('http://localhost:8000/admin/modules/1/lessons/reorder');
      expect(JSON.parse((reorderCall![1] as RequestInit).body as string)).toEqual({ ordered_ids: [8, 7, 9] });
    });
  });

  it('bir dersi "yukarı" taşıyınca yeni TAM sırayı /reorder\'a gönderir', async () => {
    render(<AdminModuleLessonsPage />);
    await waitFor(() => screen.getByText('Piyon Hareketleri'));

    fireEvent.click(screen.getByLabelText('Fil Hareketleri dersini yukarı taşı'));

    await waitFor(() => {
      const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
      const reorderCall = calls.find((c: unknown[]) => (c[0] as string).includes('/reorder'));
      expect(reorderCall).toBeTruthy();
      expect(JSON.parse((reorderCall![1] as RequestInit).body as string)).toEqual({ ordered_ids: [7, 9, 8] });
    });
  });
});
