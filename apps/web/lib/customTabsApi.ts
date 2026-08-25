import { getToken } from '@/lib/auth-storage';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface CustomTabSummary {
  id: number;
  order_index: number;
  label: string;
  emoji: string;
}

export interface CustomTabSection {
  id: number;
  order_index: number;
  title: string;
  body: string;
  images: string[];
  practice_positions: { id: string; fen: string; category?: string | null; owner?: string | null }[];
  /** İkon havuzundan seçilmiş bölüm ikonu — yoksa sporcu tarafı eski
   *  varsayılana (Kazanç/Oyunsonu için 🏆/🏁, diğerleri için 🎯) düşer. */
  emoji?: string | null;
  /** Madde 2026-08-22: bu bölümün İÇİNDE bulunduğu üst bölümün id'si — iç içe
   *  alt sekmeler. null/undefined = en üst seviye (doğrudan sekmenin altında). */
  parent_id?: number | null;
  /** Madde 2026-08-26: Alt Konu'nun Konum Havuzu — her biri KENDİ kod
   *  numarasıyla eklenen, içinde birden çok numaralı adım (konum+cümle+
   *  hamle sırası) barındıran gruplar. Hızlı Erişim'de gruplar arasında
   *  İleri/Geri, bir grubun İÇİNDEKİ adımlar arasında numaralı butonlarla
   *  gezinilir. */
  position_pool?: PositionPoolEntry[];
}

export interface PositionPoolStep {
  id: string;
  fen: string;
  sentence: string;
  turn: 'w' | 'b';
}

export interface PositionPoolEntry {
  id: string;
  code?: string | null;
  steps: PositionPoolStep[];
}

export interface CustomTabDetail {
  id: number;
  label: string;
  emoji: string;
  sections: CustomTabSection[];
}

export async function listCustomTabs(): Promise<CustomTabSummary[]> {
  try {
    const r = await fetch(`${API_BASE}/custom-tabs`);
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

export async function getCustomTab(id: number): Promise<CustomTabDetail | null> {
  try {
    const r = await fetch(`${API_BASE}/custom-tabs/${id}`);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function createCustomTab(label: string, emoji?: string): Promise<CustomTabSummary | null> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tabs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ label, ...(emoji ? { emoji } : {}) }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Madde 1/3 (2026-08-19): admin sekmenin adını ve/veya ikonunu değiştirir. */
export async function updateCustomTab(
  id: number, patch: { label?: string; emoji?: string },
): Promise<boolean> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tabs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function deleteCustomTab(id: number): Promise<boolean> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tabs/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function createCustomTabSection(
  tabId: number, title: string, body: string, images: string[], emoji?: string,
  /** Verilirse bu bölüm o bölümün ÇOCUĞU olarak eklenir (madde 2026-08-22). */
  parentId?: number,
): Promise<CustomTabSection | null> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tabs/${tabId}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title, body, images,
        ...(emoji ? { emoji } : {}),
        ...(parentId !== undefined ? { parent_id: parentId } : {}),
      }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function updateCustomTabSection(
  sectionId: number,
  patch: {
    title?: string; body?: string; images?: string[];
    practice_positions?: { id: string; fen: string; category?: string | null; owner?: string | null }[];
    emoji?: string;
    position_pool?: PositionPoolEntry[];
  },
): Promise<boolean> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tab-sections/${sectionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Madde 2026-08-22: bir bölümün İÇ İÇE YAPISINI (başlık+ikon, sınırsız
 *  derinlik) yeni bir KARDEŞ bölüme kopyalar — "Sınıflarım" gibi tekrar eden
 *  içerik akışlarını her seferinde elle kurmamak için. Yazı/görsel BOŞ
 *  başlar; kopya sonrasında kaynaktan BAĞIMSIZDIR. */
export async function duplicateCustomTabSection(
  sectionId: number, newTitle: string,
): Promise<CustomTabSection | null> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tab-sections/${sectionId}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ new_title: newTitle }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function deleteCustomTabSection(sectionId: number): Promise<boolean> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tab-sections/${sectionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Madde 2026-09-05 (4): bir sekmenin bölümlerini (bir üst bölümün TÜM
 *  kardeşlerini) verilen sırayla yeniden numaralandırır — yukarı/aşağı taşıma
 *  için kullanılır. Sunucu `ordered_ids` sırasına göre order_index=1..N atar. */
export async function reorderCustomTabSections(tabId: number, orderedIds: number[]): Promise<boolean> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tabs/${tabId}/sections/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ordered_ids: orderedIds }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
