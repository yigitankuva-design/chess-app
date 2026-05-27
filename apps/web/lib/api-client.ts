const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new ApiError(res.status, `API ${res.status} on ${path}`);
  }
  return res.json() as Promise<T>;
}

export interface HealthResponse {
  status: string;
  service: string;
}

export const apiClient = {
  health: () => request<HealthResponse>('/health'),
};
