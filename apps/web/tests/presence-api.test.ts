import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pingPresence } from '@/lib/presence/presenceApi';

const getToken = vi.fn();
vi.mock('@/lib/auth-storage', () => ({ getToken: () => getToken() }));

beforeEach(() => {
  vi.restoreAllMocks();
  getToken.mockReturnValue('test-token');
});

describe('pingPresence', () => {
  it('doğru URL, method ve token ile POST eder', async () => {
    const spy = vi.fn((_url: string, _init: RequestInit) =>
      Promise.resolve({ ok: true, json: async () => ({ count: 3 }) }));
    global.fetch = spy as never;
    await pingPresence();
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain('/presence/ping');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
  });

  it('sayıyı döner', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ count: 7 }) })) as never;
    expect(await pingPresence()).toBe(7);
  });

  it('sıfır sayıyı da doğru döner (0 ile null karışmamalı)', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ count: 0 }) })) as never;
    expect(await pingPresence()).toBe(0);
  });

  it('token yoksa istek ATMAZ ve null döner', async () => {
    getToken.mockReturnValue(null);
    const spy = vi.fn();
    global.fetch = spy as never;
    expect(await pingPresence()).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it('sunucu hata dönerse null döner', async () => {
    global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as never;
    expect(await pingPresence()).toBeNull();
  });

  it('ağ hatası fırlatırsa null döner', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('ağ yok'))) as never;
    expect(await pingPresence()).toBeNull();
  });

  it('cevapta count sayı değilse null döner', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ count: 'çok' }) })) as never;
    expect(await pingPresence()).toBeNull();
  });
});
