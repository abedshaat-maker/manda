import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface AuthState {
  loggedIn: boolean;
  username: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ loggedIn: false, username: null, loading: true });

  const checkSession = useCallback(async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      const data = await res.json();
      setState({ loggedIn: data.loggedIn, username: data.username ?? null, loading: false });
    } catch {
      setState({ loggedIn: false, username: null, loading: false });
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  const login = async (username: string, password: string): Promise<string | null> => {
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Login failed";
      setState({ loggedIn: true, username: data.username, loading: false });
      return null;
    } catch {
      return "Network error — please try again";
    }
  };

  const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setState({ loggedIn: false, username: null, loading: false });
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<string | null> => {
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || "Failed to change password";
      return null;
    } catch {
      return "Network error — please try again";
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
