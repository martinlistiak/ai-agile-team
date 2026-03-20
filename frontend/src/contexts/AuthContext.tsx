import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { User } from '@/types';
import { setAnalyticsUserId } from '@/lib/analytics';

/** Subset returned by PATCH /auth/profile (`sanitizeUser`); merged without dropping e.g. hasGithub. */
export type ProfilePatchUser = Pick<
  User,
  | 'id'
  | 'email'
  | 'name'
  | 'avatarUrl'
  | 'planTier'
  | 'subscriptionStatus'
  | 'currentPeriodEnd'
  | 'createdAt'
> & {
  emailVerified?: boolean;
  hasPassword?: boolean;
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  mergeUser: (patch: ProfilePatchUser) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const meFetchInit = {
  cache: 'no-store' as RequestCache,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  const mergeUser = useCallback((patch: ProfilePatchUser) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : null));
  }, []);

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem('token');
    if (!t) return;
    const res = await fetch('/api/auth/me', {
      ...meFetchInit,
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) return;
    setUser(await res.json());
  }, []);

  useEffect(() => {
    if (token) {
      fetch('/api/auth/me', {
        ...meFetchInit,
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => {
          if (!res.ok) throw new Error('Invalid token');
          return res.json();
        })
        .then(data => setUser(data))
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setAnalyticsUserId(user?.id ?? null);
  }, [user?.id]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(newUser);
    void (async () => {
      const res = await fetch('/api/auth/me', {
        ...meFetchInit,
        headers: { Authorization: `Bearer ${newToken}` },
      });
      if (res.ok) setUser(await res.json());
    })();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
        mergeUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
