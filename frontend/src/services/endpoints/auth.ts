import { api } from "@/services/api-client";
import type { AuthResponse, MessageResponse, User } from "@/types/auth";

export interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  display_name?: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/register", payload);
    return data;
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/login", payload);
    return data;
  },

  async logout(): Promise<MessageResponse> {
    const { data } = await api.post<MessageResponse>("/auth/logout");
    return data;
  },

  async logoutAll(): Promise<MessageResponse> {
    const { data } = await api.post<MessageResponse>("/auth/logout-all");
    return data;
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>("/auth/me");
    return data;
  },

  async verifyEmail(token: string): Promise<MessageResponse> {
    const { data } = await api.post<MessageResponse>("/auth/verify-email", {
      token,
    });
    return data;
  },

  async forgotPassword(email: string): Promise<MessageResponse> {
    const { data } = await api.post<MessageResponse>("/auth/password/forgot", {
      email,
    });
    return data;
  },

  async resetPassword(
    token: string,
    new_password: string,
  ): Promise<MessageResponse> {
    const { data } = await api.post<MessageResponse>("/auth/password/reset", {
      token,
      new_password,
    });
    return data;
  },
};
