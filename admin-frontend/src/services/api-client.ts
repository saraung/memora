import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import type { ApiErrorEnvelope } from "@/types/api";
import type { AuthResponse } from "@/types/auth";

/** Normalized error thrown for every failed API call. */
export class ApiError extends Error {
  status: number | undefined;
  code: string;
  details: Record<string, unknown>;
  requestId: string | undefined;

  constructor(
    message: string,
    opts: {
      status?: number;
      code?: string;
      details?: Record<string, unknown>;
      requestId?: string;
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code ?? "UNKNOWN_ERROR";
    this.details = opts.details ?? {};
    this.requestId = opts.requestId;
  }
}

function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorEnvelope>;
    const envelope = axiosError.response?.data?.error;
    if (envelope) {
      return new ApiError(envelope.message, {
        status: axiosError.response?.status,
        code: envelope.code,
        details: envelope.details ?? {},
        requestId: envelope.request_id,
      });
    }
    if (axiosError.code === "ERR_NETWORK") {
      return new ApiError(
        "Could not reach the server. Check your connection and try again.",
        { code: "NETWORK_ERROR" },
      );
    }
  }
  return new ApiError("Something went wrong. Please try again.");
}

/* ------------------------------------------------------------------ */
/* In-memory access token. Never persisted to localStorage.            */
/* ------------------------------------------------------------------ */

let accessToken: string | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string | null) => {
    accessToken = token;
  },
  clear: () => {
    accessToken = null;
  },
};

/* ------------------------------------------------------------------ */
/* Axios instance with auth + single-flight refresh.                   */
/* ------------------------------------------------------------------ */

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  withCredentials: true, // send/receive the HttpOnly refresh cookie
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

let refreshPromise: Promise<AuthResponse> | null = null;

/** Single-flight refresh call. Sets the in-memory token on success. */
export function refreshSession(): Promise<AuthResponse> {
  refreshPromise ??= api
    .post<AuthResponse>("/auth/refresh")
    .then((res) => {
      tokenStore.set(res.data.access_token);
      return res.data;
    })
    .catch((error: unknown) => {
      tokenStore.clear();
      throw normalizeError(error);
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

const NO_RETRY_URLS = ["/auth/login", "/auth/refresh", "/auth/register"];

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const axiosError = error as AxiosError;
    const original = axiosError.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const status = axiosError.response?.status;
    const url = original?.url ?? "";
    const shouldRetry =
      status === 401 &&
      original &&
      !original._retry &&
      !NO_RETRY_URLS.some((path) => url.includes(path));

    if (shouldRetry && original) {
      original._retry = true;
      try {
        const session = await refreshSession();
        original.headers = {
          ...(original.headers ?? {}),
          Authorization: `Bearer ${session.access_token}`,
        };
        return api(original);
      } catch (refreshError) {
        // Session is gone: force a clean return to the staff sign-in.
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.startsWith("/login")
        ) {
          window.location.assign("/login?expired=1");
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(normalizeError(error));
  },
);
