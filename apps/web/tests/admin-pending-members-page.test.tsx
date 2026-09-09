import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Madde 2026-09-09 (Üyelik Girişi Yenileme, AŞAMA 3): admin "Onay
// Bekleyenler" ekranı — kendi kaydolan ANTRENÖR başvurularını listeler,
// Onayla/Reddet ile karar verir. Madde (devam 4): Zafer'in kararıyla
// SADECE antrenör başvuruları buraya düşer — sporcu (18+ dahil) onaya
// tabi değil.
vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

import AdminPendingMembersPage from '@/app/admin/onay-bekleyenler/page';

const PENDING_ROW = {
  id: 7, name: 'Zeynep Kara', email: 'zeynep@test.com', username: 'zeynepkara',
  phone: '5551234567', province: 'Bilecik', lichess_username: 'zeynepchess',
  created_at: '2026-09-09T10:00:00',
};

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => [PENDING_ROW] })) as never;
});

describe('Admin — Onay Bekleyenler (madde 2026-09-09, AŞAMA 3, devam 4: antrenör başvuruları)', () => {
  it('bekleyen antrenör başvurusunu listeler — isim, kullanıcı adı, telefon, şehir, Lichess, e-posta', async () => {
    render(<AdminPendingMembersPage />);
    await waitFor(() => screen.getByText('Zeynep Kara'));
    expect(screen.getByText('zeynepkara')).toBeInTheDocument();
    expect(screen.getByText('5551234567')).toBeInTheDocument();
    expect(screen.getByText('Bilecik')).toBeInTheDocument();
    expect(screen.getByText('zeynepchess')).toBeInTheDocument();
    expect(screen.getByText('zeynep@test.com')).toBeInTheDocument();
  });

  it('liste boşken bilgi mesajı gösterir', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => [] });
    render(<AdminPendingMembersPage />);
    await waitFor(() => screen.getByText('Onay bekleyen başvuru yok.'));
  });

  it('Onayla tıklanınca doğru uca POST atar ve satırı listeden kaldırır', async () => {
    render(<AdminPendingMembersPage />);
    await waitFor(() => screen.getByText('Zeynep Kara'));

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    fireEvent.click(screen.getByText('Onayla'));

    await waitFor(() => {
      expect(screen.queryByText('Zeynep Kara')).not.toBeInTheDocument();
    });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
    expect(call[0]).toContain('/admin/pending-members/7/approve');
    expect(call[1].method).toBe('POST');
  });

  it('Reddet tıklanınca doğru uca POST atar ve satırı listeden kaldırır', async () => {
    render(<AdminPendingMembersPage />);
    await waitFor(() => screen.getByText('Zeynep Kara'));

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    fireEvent.click(screen.getByText('Reddet'));

    await waitFor(() => {
      expect(screen.queryByText('Zeynep Kara')).not.toBeInTheDocument();
    });
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
    expect(call[0]).toContain('/admin/pending-members/7/reject');
  });

  it('işlem başarısız olursa satır listede kalır, hata gösterilir', async () => {
    render(<AdminPendingMembersPage />);
    await waitFor(() => screen.getByText('Zeynep Kara'));

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    fireEvent.click(screen.getByText('Onayla'));

    await waitFor(() => {
      expect(screen.getByText('İşlem başarısız oldu, tekrar dene.')).toBeInTheDocument();
    });
    expect(screen.getByText('Zeynep Kara')).toBeInTheDocument();
  });
});
