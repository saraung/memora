import { api } from "@/services/api-client";
import type { PostPage } from "@/types/content";
import type {
  HashtagPage,
  UserSearchPage,
} from "@/types/search";

export const searchApi = {
  async users(query: string, cursor?: string): Promise<UserSearchPage> {
    const { data } = await api.get<UserSearchPage>("/search/users", {
      params: { q: query, limit: 20, cursor },
    });
    return data;
  },

  async posts(query: string, cursor?: string): Promise<PostPage> {
    const { data } = await api.get<PostPage>("/search/posts", {
      params: { q: query, limit: 10, cursor },
    });
    return data;
  },

  async hashtags(query: string, cursor?: string): Promise<HashtagPage> {
    const { data } = await api.get<HashtagPage>("/search/hashtags", {
      params: { q: query, limit: 20, cursor },
    });
    return data;
  },

  async tagPosts(tag: string, cursor?: string): Promise<PostPage> {
    const { data } = await api.get<PostPage>(
      `/hashtags/${encodeURIComponent(tag)}/posts`,
      { params: { limit: 12, cursor } },
    );
    return data;
  },
};
