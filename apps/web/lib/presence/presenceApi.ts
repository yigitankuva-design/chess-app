import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * "Uygulamadayim" sinyali gonderir ve AKTIF DIGER sporcu sayisini doner.
 *
 * null = bilinmiyor (token yok / ag hatasi / bozuk cevap). Cagiran taraf null
 * gorunce rozeti HIC gostermez — uydurma sayi gosterilmez (KURAL #1).
 * 0 ile null'i karistirma: 0 gecerli bir cevaptir ("baska kimse yok").
 */
export async function pingPresence(): Promise<number | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const r = await fetch(`${API_BASE}/presence/ping`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const data = await r.json();
    return typeof data?.count === 'number' ? data.count : null;
  } catch {
    return null;
  }
}
