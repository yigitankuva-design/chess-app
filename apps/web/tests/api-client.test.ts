import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient, ApiError } from '@/lib/api-client';

describe('apiClient.health', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns parsed JSON on 200', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', service: 'chess-api' }),
    });
    const result = await apiClient.health();
    expect(result).toEqual({ status: 'ok', service: 'chess-api' });
  });

  it('throws ApiError on non-2xx', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 503,
    });
    await expect(apiClient.health()).rejects.toThrow(ApiError);
  });
});
