import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POOL_CATEGORIES, fetchPoolImages, addPoolImage } from '@/lib/admin/poolApi';

vi.mock('@/lib/auth-storage', () => ({ getToken: () => 'test-token' }));

const TINY = 'data:image/png;base64,AAAA';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('POOL_CATEGORIES', () => {
  it('on iki kategori vardır ve backend ile AYNI sıradadır', () => {
    expect(POOL_CATEGORIES).toEqual([
      'Geometrik Şekiller', 'Satranç Tahtası', 'Satranç Taşları', 'Hayvanlar',
      'Bitkiler', 'Taşıtlar', 'Gezegenler', 'Meslekler', 'Gök Cisimleri',
      'Satranç Şampiyonları', 'Harfler', 'Rakamlar',
    ]);
  });
});

describe('fetchPoolImages', () => {
  it('kategoriyi URL-kodlayarak sorgular', async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true, json: async () => [] }));
    global.fetch = spy as never;
    await fetchPoolImages('Gök Cisimleri');
    expect(spy).toHaveBeenCalledTimes(1);
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain('/pool-images?category=');
    expect(url).toContain(encodeURIComponent('Gök Cisimleri'));
  });

  it('gelen listeyi döner', async () => {
    global.fetch = vi.fn(() => Promise.resolve({
      ok: true,
      json: async () => [{ id: 1, category: 'Hayvanlar', data_uri: TINY }],
    })) as never;
    const list = await fetchPoolImages('Hayvanlar');
    expect(list).toHaveLength(1);
    expect(list[0].data_uri).toBe(TINY);
  });

  it('istek başarısızsa boş liste döner (ekran çökmez)', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as never;
    expect(await fetchPoolImages('Hayvanlar')).toEqual([]);
  });

  it('ağ hatası fırlatırsa boş liste döner', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('ağ yok'))) as never;
    expect(await fetchPoolImages('Hayvanlar')).toEqual([]);
  });
});

describe('addPoolImage', () => {
  it('token ve doğru gövde ile POST eder', async () => {
    const spy = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ created: true }) }));
    global.fetch = spy as never;
    await addPoolImage('Bitkiler', TINY);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain('/admin/pool-images');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    expect(JSON.parse(init.body as string)).toEqual({
      category: 'Bitkiler', data_uri: TINY,
    });
  });

  it('başarıda true döner', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({ created: true }) })) as never;
    expect(await addPoolImage('Bitkiler', TINY)).toBe(true);
  });

  it('başarısızlıkta false döner', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as never;
    expect(await addPoolImage('Bitkiler', TINY)).toBe(false);
  });

  it('ağ hatası fırlatırsa false döner', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('ağ yok'))) as never;
    expect(await addPoolImage('Bitkiler', TINY)).toBe(false);
  });
});
