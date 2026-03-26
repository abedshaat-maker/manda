import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const TOKEN_KEY = "adm_auth_token";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AuthState {
  loggedIn: boolean;
  username: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
}

setAuthTokenGetter(getToken);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ loggedIn: false, username: null, loading: true });

  const checkSession = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setState({ loggedIn: false, username: null, loading: false });
      return;
    }
    try {
      const res = await apiFetch("/api/auth/me");
      const data = await res.json();
      setState({ loggedIn: data.loggedIn, username: data.username ?? null, loading: false });
      if (!data.loggedIn) clearToken();
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
      saveToken(data.token);
      setState({ loggedIn: true, username: data.username, loading: false });
      return null;
    } catch {
      return "Network error — please try again";
    }
  };

  const logout = () => {
    clearToken();
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
