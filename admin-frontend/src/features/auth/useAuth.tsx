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
import { authApi, type LoginPayload } from "@/services/endpoints/auth";
import type { PermissionCode } from "@/lib/permissions";import type { User } from "@/types/auth";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (payload: LoginPayload) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (code: PermissionCode) => boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

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

  // Silent session restore on app load via the HttpOnly refresh cookie.
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

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const current = await authApi.me();
    setUser(current);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const permissions = user?.permissions ?? [];
    return {
      status,
      user,
      login,
      logout,
      refreshUser,
      hasPermission: (code: PermissionCode) => permissions.includes(code),
      isStaff: permissions.length > 0,
    };
  }, [status, user, login, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Convenience: does the current staff member hold a permission? */
export function useHasPermission(code: PermissionCode): boolean {
  return useAuth().hasPermission(code);
}
