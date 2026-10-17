import { api } from "@/services/api-client";
import type { AuthResponse, MessageResponse, User } from "@/types/auth";

export interface LoginPayload {
  identifier: string;
  password: string;
}

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/login", payload);
    return data;
  },

  async me(): Promise<User> {
    const { data } = await api.get<User>("/auth/me");
    return data;
  },

  async logout(): Promise<MessageResponse> {
    const { data } = await api.post<MessageResponse>("/auth/logout");
    return data;
  },
};
