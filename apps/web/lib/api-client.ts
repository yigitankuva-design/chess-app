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

// ===== Schemas =====

export interface HealthResponse {
  status: string;
  service: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  role: 'parent' | 'teacher' | 'athlete';
  name: string;
}

export interface ParentSignupBody {
  email: string;
  password: string;
  name: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

// ===== Client =====

export const apiClient = {
  health: () => request<HealthResponse>('/health'),

  parentSignup: (body: ParentSignupBody) =>
    request<AuthResponse>('/auth/parent/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  teacherSignup: (body: ParentSignupBody) =>
    request<AuthResponse>('/auth/teacher/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  login: (body: LoginBody) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  childEnter: (body: { child_profile_id: number; device_fingerprint: string }) =>
    request<{ access_token: string; child_profile_id: number; display_name: string }>(
      '/auth/child/enter',
      { method: 'POST', body: JSON.stringify(body) },
    ),
};
