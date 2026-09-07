import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * Madde 2026-09-07 (Antrenör Paneli, 5): /admin artık SADECE role==='admin'
 * ile açılır — sıradan bir antrenör (role='teacher') hesabı buraya
 * giremez, ana giriş ekranına yönlendirilir. `hydrated` henüz false iken
 * (F5 anı) YANLIŞ yönlendirme OLMADIĞI ayrıca doğrulanır (bkz.
 * coach-home-page.test.tsx'teki AYNI koruma deseni).
 */
const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/admin/parents',
}));

let mockRole: 'admin' | 'teacher' | null = 'admin';
let mockHydrated = true;
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ role: mockRole, hydrated: mockHydrated, token: 'tok', userId: 1, login: vi.fn(), logout: vi.fn() }),
}));

let mockToken: string | null = 'tok';
vi.mock('@/lib/auth-storage', () => ({ getToken: () => mockToken }));

beforeEach(() => {
  mockRole = 'admin';
  mockHydrated = true;
  mockToken = 'tok';
  replace.mockClear();
});

import AdminLayout from '@/app/admin/layout';

describe('AdminLayout — sadece gerçek yönetici (madde 2026-09-07, 5)', () => {
  it('role admin + token varken içerik render edilir, yönlendirme YOK', async () => {
    render(<AdminLayout><p>İçerik</p></AdminLayout>);
    await waitFor(() => screen.getByText('İçerik'));
    expect(replace).not.toHaveBeenCalled();
  });

  it('role teacher iken (sıradan antrenör) dışarı atılır — admin panelini GÖREMEZ', async () => {
    mockRole = 'teacher';
    render(<AdminLayout><p>İçerik</p></AdminLayout>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    expect(screen.queryByText('İçerik')).not.toBeInTheDocument();
  });

  it('token yoksa dışarı atılır', async () => {
    mockToken = null;
    render(<AdminLayout><p>İçerik</p></AdminLayout>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('hydrated henüz false iken (F5 anı) YANLIŞ yönlendirme yapılmaz', () => {
    mockHydrated = false;
    render(<AdminLayout><p>İçerik</p></AdminLayout>);
    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
