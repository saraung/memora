import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { refreshSession, tokenStore } from "@/services/api-client";
import {
  authApi,
  type LoginPayload,
  type RegisterPayload,
} from "@/services/endpoints/auth";
import type { User } from "@/types/auth";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  // The "me" query is the contract for syncing the auth context: any
  // mutation that invalidates socialKeys.me (privacy, profile, avatar,
  // blocks...) makes this refetch and flow the fresh user into context.
  // staleTime: Infinity keeps it from firing on its own — only explicit
  // invalidations (and the enabled flip on login) trigger a refetch.
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    enabled: status === "authenticated",
    staleTime: Infinity,
  });

  useEffect(() => {
    if (status !== "authenticated") return;
    if (meQuery.data) setUser(meQuery.data);
  }, [meQuery.data, status]);

  // Silent session restore on app load via the HttpOnly cookie.
  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .then((session) => {
        if (cancelled) return;
        setUser(session.user);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearSession = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStatus("anonymous");
    queryClient.clear();
  }, [queryClient]);

  const login = useCallback(async (payload: LoginPayload) => {
    const session = await authApi.login(payload);
    tokenStore.set(session.access_token);
    setUser(session.user);
    setStatus("authenticated");
    return session.user;
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const session = await authApi.register(payload);
    tokenStore.set(session.access_token);
    setUser(session.user);
    setStatus("authenticated");
    return session.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const current = await authApi.me();
    setUser(current);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login,
      register,
      logout,
      logoutAll,
      refreshUser,
    }),
    [status, user, login, register, logout, logoutAll, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
