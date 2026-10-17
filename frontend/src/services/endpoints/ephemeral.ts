import { api } from "@/services/api-client";
import type {
  AuthorStories,
  Reel,
  ReelComment,
  ReelCommentPage,
  ReelPage,
  ReelViewResult,
  Story,
  StoryFeedPage,
  StoryPage,
} from "@/types/ephemeral";
import type { UserSummary } from "@/types/social";
import { uploadToProvider, type UploadIntent } from "@/services/endpoints/content";

export { uploadToProvider, type UploadIntent };

export const ephemeralApi = {
  // -- Stories ---------------------------------------------------------
  async publishStory(media_id: string, caption: string | null): Promise<Story> {
    const { data } = await api.post<Story>("/stories", { media_id, caption });
    return data;
  },

  async storyFeed(cursor?: string): Promise<StoryFeedPage> {
    const { data } = await api.get<StoryFeedPage>("/stories/feed", {
      params: { limit: 20, cursor },
    });
    return data;
  },

  async getStory(storyId: string): Promise<Story> {
    const { data } = await api.get<Story>(`/stories/${storyId}`);
    return data;
  },

  async viewStory(storyId: string): Promise<Story> {
    const { data } = await api.post<Story>(`/stories/${storyId}/views`);
    return data;
  },

  async storyViewers(storyId: string): Promise<UserSummary[]> {
    const { data } = await api.get<UserSummary[]>(`/stories/${storyId}/viewers`);
    return data;
  },

  async userStories(username: string, cursor?: string): Promise<StoryPage> {
    const { data } = await api.get<StoryPage>(
      `/users/${encodeURIComponent(username)}/stories`,
      { params: { limit: 20, cursor } },
    );
    return data;
  },

  async deleteStory(storyId: string): Promise<void> {
    await api.delete(`/stories/${storyId}`);
  },

  // -- Reels -----------------------------------------------------------
  async publishReel(
    video_id: string,
    cover_id: string | null,
    caption: string | null,
  ): Promise<Reel> {
    const { data } = await api.post<Reel>("/reels", {
      video_id,
      cover_id,
      caption,
    });
    return data;
  },

  async getReel(reelId: string): Promise<Reel> {
    const { data } = await api.get<Reel>(`/reels/${reelId}`);
    return data;
  },

  async reelFeed(cursor?: string): Promise<ReelPage> {
    const { data } = await api.get<ReelPage>("/reels/feed", {
      params: { limit: 10, cursor },
    });
    return data;
  },

  async userReels(username: string, cursor?: string): Promise<ReelPage> {
    const { data } = await api.get<ReelPage>(
      `/users/${encodeURIComponent(username)}/reels`,
      { params: { limit: 12, cursor } },
    );
    return data;
  },

  async recordReelView(reelId: string): Promise<ReelViewResult> {
    const { data } = await api.post<ReelViewResult>(`/reels/${reelId}/views`);
    return data;
  },

  async likeReel(reelId: string): Promise<void> {
    await api.put(`/reels/${reelId}/like`);
  },

  async unlikeReel(reelId: string): Promise<void> {
    await api.delete(`/reels/${reelId}/like`);
  },

  async deleteReel(reelId: string): Promise<void> {
    await api.delete(`/reels/${reelId}`);
  },

  async saveReel(reelId: string): Promise<void> {
    await api.put(`/reels/${reelId}/save`);
  },

  async unsaveReel(reelId: string): Promise<void> {
    await api.delete(`/reels/${reelId}/save`);
  },

  async savedReels(cursor?: string): Promise<ReelPage> {
    const { data } = await api.get<ReelPage>("/reels/saved", {
      params: { limit: 12, cursor },
    });
    return data;
  },

  // -- Reel comments ---------------------------------------------------
  async reelComments(reelId: string, cursor?: string): Promise<ReelCommentPage> {
    const { data } = await api.get<ReelCommentPage>(
      `/reels/${reelId}/comments`,
      { params: { limit: 20, cursor } },
    );
    return data;
  },

  async createReelComment(
    reelId: string,
    body: string,
    parentId: string | null = null,
  ): Promise<ReelComment> {
    const { data } = await api.post<ReelComment>(`/reels/${reelId}/comments`, {
      body,
      parent_id: parentId,
    });
    return data;
  },

  async deleteReelComment(reelId: string, commentId: string): Promise<void> {
    await api.delete(`/reels/${reelId}/comments/${commentId}`);
  },
};

export type { AuthorStories };
