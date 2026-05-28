'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getToken, saveToken, clearAuth } from './auth-storage';

type Role = 'parent' | 'teacher' | 'child' | null;

interface AuthState {
  token: string | null;
  role: Role;
  userId: number | null;
}

interface AuthContextValue extends AuthState {
  login: (token: string, role: Role, userId: number) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);


function parseToken(token: string): { role: Role; userId: number | null } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { role: null, userId: null };
    const payload = JSON.parse(atob(parts[1]));
    return {
      role: (payload.role as Role) ?? null,
      userId: (payload.user_id ?? payload.child_profile_id ?? null) as number | null,
    };
  } catch {
    return { role: null, userId: null };
  }
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    token: null, role: null, userId: null,
  });

  useEffect(() => {
    const token = getToken();
    if (token) {
      const parsed = parseToken(token);
      if (parsed.userId !== null) {
        setState({ token, role: parsed.role, userId: parsed.userId });
      } else {
        clearAuth();
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state,
      login: (token, role, userId) => {
        saveToken(token);
        setState({ token, role, userId });
      },
      logout: () => {
        clearAuth();
        setState({ token: null, role: null, userId: null });
      },
    }}>
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
