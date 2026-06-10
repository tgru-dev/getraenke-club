import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, getToken, setToken, NetworkError } from "./api";
import type { PublicMember } from "../../shared/types";

const MEMBER_KEY = "gc_member";

interface AuthState {
  member: PublicMember | null;
  loading: boolean;
  login: (memberId: number, pin: string, remember: boolean) => Promise<void>;
  logout: () => void;
  setSession: (token: string, member: PublicMember) => void;
}

const AuthContext = createContext<AuthState>(null!);

export function useAuth() {
  return useContext(AuthContext);
}

function readCachedMember(): PublicMember | null {
  try {
    return JSON.parse(localStorage.getItem(MEMBER_KEY) ?? "null") as PublicMember | null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<PublicMember | null>(() =>
    getToken() ? readCachedMember() : null
  );
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api<{ member: PublicMember }>("/auth/me")
      .then((res) => {
        setMember(res.member);
        localStorage.setItem(MEMBER_KEY, JSON.stringify(res.member));
      })
      .catch((e) => {
        // Offline: zwischengespeichertes Mitglied behalten, damit die PWA nutzbar bleibt
        if (!(e instanceof NetworkError)) {
          setToken(null);
          localStorage.removeItem(MEMBER_KEY);
          setMember(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const setSession = (token: string, m: PublicMember) => {
    setToken(token);
    localStorage.setItem(MEMBER_KEY, JSON.stringify(m));
    setMember(m);
  };

  const login = async (memberId: number, pin: string, remember: boolean) => {
    const res = await api<{ token: string; member: PublicMember }>("/auth/login", {
      method: "POST",
      body: { memberId, pin, remember },
    });
    setSession(res.token, res.member);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem(MEMBER_KEY);
    setMember(null);
  };

  return (
    <AuthContext.Provider value={{ member, loading, login, logout, setSession }}>
      {children}
    </AuthContext.Provider>
  );
}
