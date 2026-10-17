import type { Paginated } from "@/types/api";
import type { UserSummary } from "@/types/social";

export type SearchTab = "people" | "posts" | "tags";

export interface HashtagItem {
  tag: string;
  usage_count: number;
}

export type HashtagPage = Paginated<HashtagItem>;
export type UserSearchPage = Paginated<UserSummary>;
