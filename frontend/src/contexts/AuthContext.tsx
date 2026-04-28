import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { User } from "@/types";
import { setAnalyticsUserId } from "@/lib/analytics";

/** Subset returned by PATCH /auth/profile (`sanitizeUser`); merged without dropping e.g. hasGithub. */
export type ProfilePatchUser = Pick<
  User,
  | "id"
  | "email"
  | "name"
  | "avatarUrl"
  | "planTier"
  | "subscriptionStatus"
  | "currentPeriodEnd"
  | "createdAt"
  | "hasGithub"
  | "hasGitlab"
  | "hasGithubReviewer"
> & {
  emailVerified?: boolean;
  hasPassword?: boolean;
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isImpersonating: boolean;
  isReadOnly: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  mergeUser: (patch: ProfilePatchUser) => void;
  startImpersonation: (token: string, user: User) => void;
  stopImpersonation: (token: string, user: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const meFetchInit = {
  cache: "no-store" as RequestCache,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token"),
  );
  const [isLoading, setIsLoading] = useState(true);

  const isImpersonating = user?.isImpersonating ?? false;
  const isReadOnly = user?.isReadOnly ?? false;

  const mergeUser = useCallback((patch: ProfilePatchUser) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : null));
  }, []);

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem("token");
    if (!t) return;
    const res = await fetch("/api/auth/me", {
      ...meFetchInit,
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) return;
    setUser(await res.json());
  }, []);

  useEffect(() => {
    if (token) {
      fetch("/api/auth/me", {
        ...meFetchInit,
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (!res.ok) throw new Error("Invalid token");
          return res.json();
        })
        .then((data) => setUser(data))
        .catch(() => {
          localStorage.removeItem("token");
          localStorage.removeItem("originalToken");
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
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
    void (async () => {
      const res = await fetch("/api/auth/me", {
        ...meFetchInit,
        headers: { Authorization: `Bearer ${newToken}` },
      });
      if (res.ok) setUser(await res.json());
    })();
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("originalToken");
    setToken(null);
    setUser(null);
  };

  const startImpersonation = (newToken: string, newUser: User) => {
    // Save original token before impersonating
    const currentToken = localStorage.getItem("token");
    if (currentToken) {
      localStorage.setItem("originalToken", currentToken);
    }
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser({ ...newUser, isImpersonating: true, isReadOnly: true });
  };

  const stopImpersonation = (newToken: string, newUser: User) => {
    localStorage.removeItem("originalToken");
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        isImpersonating,
        isReadOnly,
        login,
        logout,
        refreshUser,
        mergeUser,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
