/** Auth domain types mirroring the backend contracts. */

export type AccountStatus = "active" | "suspended" | "deactivated" | "deleted";

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  account_status: AccountStatus;
  is_private: boolean;
  created_at: string;
  /** Staff authorization context (empty for ordinary users). */
  roles: string[];
  permissions: string[];
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface MessageResponse {
  message: string;
}
