import type { Paginated } from "@/types/api";
import type { UserSummary } from "@/types/social";

export interface PostMedia {
  id: string;
  resource_type: "image" | "video";
  format: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  secure_url: string;
  alt_text: string | null;
}

export interface Post {
  id: string;
  caption: string | null;
  author: UserSummary;
  media: PostMedia[];
  like_count: number;
  comment_count: number;
  liked: boolean;
  bookmarked: boolean;
  /** "following" for follows content, "discovery" for cold-start fallback. */
  source: "following" | "discovery";
  created_at: string;
  updated_at: string;
}

export type PostPage = Paginated<Post>;

export interface CommentItem {
  id: string;
  body: string;
  parent_id: string | null;
  author: UserSummary;
  created_at: string;
  updated_at: string;
}

export type CommentPage = Paginated<CommentItem>;

export interface MediaAsset {
  id: string;
  resource_type: string;
  format: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  secure_url: string;
  status: string;
  created_at: string;
}
