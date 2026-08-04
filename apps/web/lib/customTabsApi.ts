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
  practice_positions: { id: string; fen: string }[];
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

export async function createCustomTab(label: string): Promise<CustomTabSummary | null> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tabs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ label }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
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
  tabId: number, title: string, body: string, images: string[],
): Promise<CustomTabSection | null> {
  const token = getToken();
  try {
    const r = await fetch(`${API_BASE}/admin/custom-tabs/${tabId}/sections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, body, images }),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

export async function updateCustomTabSection(
  sectionId: number,
  patch: { title?: string; body?: string; images?: string[]; practice_positions?: { id: string; fen: string }[] },
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
