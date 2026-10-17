import type { Paginated } from "@/types/api";
import type { UserSummary } from "@/types/social";

export interface StoryMedia {
  id: string;
  resource_type: "image" | "video";
  format: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  secure_url: string;
}

export interface Story {
  id: string;
  caption: string | null;
  author: UserSummary;
  media: StoryMedia;
  viewed: boolean;
  created_at: string;
  expires_at: string;
}

export interface AuthorStories {
  author: UserSummary;
  stories: Story[];
  has_unseen: boolean;
}

export type StoryFeedPage = Paginated<AuthorStories>;

export type StoryPage = Paginated<Story>;

export interface Reel {
  id: string;
  caption: string | null;
  author: UserSummary;
  video: StoryMedia;
  cover: StoryMedia | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  liked: boolean;
  saved: boolean;
  created_at: string;
}

export type ReelPage = Paginated<Reel>;

export interface ReelComment {
  id: string;
  body: string;
  parent_id: string | null;
  author: UserSummary;
  created_at: string;
  updated_at: string;
}

export type ReelCommentPage = Paginated<ReelComment>;

export interface ReelViewResult {
  view_count: number;
  counted: boolean;
  reel: Reel;
}
