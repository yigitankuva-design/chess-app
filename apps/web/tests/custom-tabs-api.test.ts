import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listCustomTabs, getCustomTab } from '@/lib/customTabsApi';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'tok' }));

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('customTabsApi', () => {
  it('listCustomTabs GET /custom-tabs çağırır ve listeyi döner', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, json: () => Promise.resolve([{ id: 1, order_index: 1, label: 'Turnuvalar', emoji: '📌' }]),
    });
    const result = await listCustomTabs();
    expect(result).toEqual([{ id: 1, order_index: 1, label: 'Turnuvalar', emoji: '📌' }]);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/custom-tabs'));
  });

  it('listCustomTabs başarısız olursa boş dizi döner', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
    expect(await listCustomTabs()).toEqual([]);
  });

  it('getCustomTab GET /custom-tabs/{id} çağırır ve detayı döner', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true, json: () => Promise.resolve({ id: 1, label: 'Turnuvalar', emoji: '📌', sections: [] }),
    });
    const result = await getCustomTab(1);
    expect(result).toEqual({ id: 1, label: 'Turnuvalar', emoji: '📌', sections: [] });
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/custom-tabs/1'));
  });

  it('getCustomTab bulunamazsa null döner', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
    expect(await getCustomTab(999)).toBeNull();
  });
});
