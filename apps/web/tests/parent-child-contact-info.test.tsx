import { Suspense } from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'parent-tok' }));

const SUMMARY = {
  child_id: 7, display_name: 'Emir', avatar: 'lion', age: 10,
  lessons_completed: 2, badges_earned: 1, rank_name: 'Çaylak', xp_total: 40,
  daily_minutes_limit: null,
  activity_7days: [],
  province: null, athlete_phone: null, athlete_email: null,
  father_name: null, father_phone: null, father_email: null,
  mother_name: null, mother_phone: null, mother_email: null,
};

let lastPatchBody: unknown = null;

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
    if (url.includes('/contact-info')) {
      lastPatchBody = opts?.body ? JSON.parse(opts.body as string) : null;
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) });
    }
    if (url.includes('/summary')) return Promise.resolve({ ok: true, json: async () => SUMMARY });
    return Promise.resolve({ ok: false, json: async () => null });
  }) as unknown as typeof fetch);
}

import ChildDetailPage from '@/app/parent/child/[id]/page';

describe('Veli — çocuk detay sayfası: İletişim Bilgileri formu (madde 2026-09-07, GRUP C)', () => {
  beforeEach(() => { stubFetch(); lastPatchBody = null; });

  it('il + baba telefonu girilip kaydedilince sadece dolu alanlar PATCH edilir', async () => {
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <ChildDetailPage params={Promise.resolve({ id: '7' })} />
        </Suspense>,
      );
    });
    await waitFor(() => screen.getByText('İletişim Bilgileri'));

    fireEvent.change(screen.getByLabelText('İl'), { target: { value: 'Bilecik' } });
    fireEvent.change(screen.getByLabelText('Baba Telefon'), { target: { value: '05551112233' } });
    // Sayfada 2 "Kaydet" butonu var (Günlük süre sınırı + İletişim Bilgileri) —
    // İletişim Bilgileri kartındaki İKİNCİSİ.
    const saveButtons = screen.getAllByRole('button', { name: 'Kaydet' });
    fireEvent.click(saveButtons[saveButtons.length - 1]);

    await waitFor(() => expect(lastPatchBody).toEqual({ province: 'Bilecik', father_phone: '05551112233' }));
    await waitFor(() => screen.getByText('✓ Kaydedildi'));
  });
});
