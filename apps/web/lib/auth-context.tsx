'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getToken, saveToken, clearAuth } from './auth-storage';

type Role = 'parent' | 'teacher' | 'child' | 'athlete' | 'admin' | null;

interface AuthState {
  token: string | null;
  role: Role;
  userId: number | null;
}

interface AuthContextValue extends AuthState {
  /** Madde 2026-09-07 (Antrenör Paneli, 5): sessionStorage'daki token'ın
   *  okunup çözülmesi bir `useEffect` içinde olur — İLK render'da HENÜZ
   *  çalışmamıştır. Bir sayfa `role`'e bakıp YÖNLENDİRME kararı veriyorsa
   *  (ör. "/coach"un teacher koruması) bunu `hydrated` GERÇEKTEN `true`
   *  olana kadar ERTELEMELİ — yoksa geçerli bir token'la gelen kullanıcı
   *  bile `role` henüz `null`ken (React child effect'leri PARENT'tan ÖNCE
   *  çalışır — bu Provider'ın kendi effect'i çalışmadan) YANLIŞLIKLA
   *  dışarı atılır. */
  hydrated: boolean;
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
  // Madde 2026-09-07 (Antrenör Paneli, 5): aşağıdaki effect bitene kadar
  // false — bkz. AuthContextValue.hydrated doc-comment'i.
  const [hydrated, setHydrated] = useState(false);

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
    setHydrated(true);
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state,
      hydrated,
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
