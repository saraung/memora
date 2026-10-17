import type { Paginated } from "@/types/api";

export type Relationship = "self" | "following" | "requested" | "none";

export interface UserSummary {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  last_seen_at: string | null;
}

export interface Profile extends UserSummary {
  bio: string | null;
  links: string[] | null;
  is_private: boolean;
  account_status: string;
  follower_count: number;
  following_count: number;
  relationship: Relationship;
  created_at: string;
}

export type FollowStatus = "followed" | "requested" | "unfollowed";
export type BlockStatus = "blocked" | "unblocked";

export interface FollowRequestItem {
  id: string;
  status: string;
  created_at: string;
  requester: UserSummary;
}

export type UserPage = Paginated<UserSummary>;

export interface UpdateProfilePayload {
  display_name?: string;
  bio?: string | null;
  avatar_url?: string | null;
  links?: string[] | null;
}
