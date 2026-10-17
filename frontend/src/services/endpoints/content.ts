import { api } from "@/services/api-client";
import type {
  CommentItem,
  CommentPage,
  MediaAsset,
  Post,
  PostPage,
} from "@/types/content";

export interface UploadIntent {
  id: string;
  public_id: string;
  resource_type: string;
  expires_at: string;
  upload_url: string;
  params: Record<string, unknown>;
}

/** Browser direct upload to the storage provider (no auth headers). */
export async function uploadToProvider(
  intent: UploadIntent,
  file: File,
): Promise<void> {
  const form = new FormData();
  for (const [key, value] of Object.entries(intent.params)) {
    form.append(key, String(value));
  }
  form.append("file", file);
  const response = await fetch(intent.upload_url, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new Error("Upload to media storage failed. Please try again.");
  }
}

export const contentApi = {
  async createUploadIntent(
    expected_mime: string,
    expected_bytes: number,
  ): Promise<UploadIntent> {
    const { data } = await api.post<UploadIntent>("/media/upload-intents", {
      expected_mime,
      expected_bytes,
    });
    return data;
  },

  async completeUpload(intentId: string): Promise<MediaAsset> {
    const { data } = await api.post<MediaAsset>(
      `/media/upload-intents/${intentId}/complete`,
    );
    return data;
  },

  async createPost(
    caption: string | null,
    items: { media_id: string; alt_text?: string }[],
  ): Promise<Post> {
    const { data } = await api.post<Post>("/posts", { caption, items });
    return data;
  },

  async getPost(postId: string): Promise<Post> {
    const { data } = await api.get<Post>(`/posts/${postId}`);
    return data;
  },

  async deletePost(postId: string): Promise<void> {
    await api.delete(`/posts/${postId}`);
  },

  async like(postId: string): Promise<void> {
    await api.put(`/posts/${postId}/like`);
  },

  async unlike(postId: string): Promise<void> {
    await api.delete(`/posts/${postId}/like`);
  },

  async bookmark(postId: string): Promise<void> {
    await api.put(`/posts/${postId}/bookmark`);
  },

  async unbookmark(postId: string): Promise<void> {
    await api.delete(`/posts/${postId}/bookmark`);
  },

  async bookmarks(cursor?: string): Promise<PostPage> {
    const { data } = await api.get<PostPage>("/users/me/bookmarks", {
      params: { limit: 20, cursor },
    });
    return data;
  },

  async comments(postId: string, cursor?: string): Promise<CommentPage> {
    const { data } = await api.get<CommentPage>(
      `/posts/${postId}/comments`,
      { params: { limit: 20, cursor } },
    );
    return data;
  },

  async createComment(
    postId: string,
    body: string,
    parent_id?: string,
  ): Promise<CommentItem> {
    const { data } = await api.post<CommentItem>(
      `/posts/${postId}/comments`,
      { body, parent_id },
    );
    return data;
  },

  async deleteComment(commentId: string): Promise<void> {
    await api.delete(`/comments/${commentId}`);
  },

  async feed(cursor?: string): Promise<PostPage> {
    const { data } = await api.get<PostPage>("/feed", {
      params: { limit: 10, cursor },
    });
    return data;
  },

  async explore(cursor?: string): Promise<PostPage> {
    const { data } = await api.get<PostPage>("/explore", {
      params: { limit: 12, cursor },
    });
    return data;
  },

  async profilePosts(username: string, cursor?: string): Promise<PostPage> {
    const { data } = await api.get<PostPage>(
      `/users/${encodeURIComponent(username)}/posts`,
      { params: { limit: 12, cursor } },
    );
    return data;
  },
};

/** Avatar uploads accept the same image types as other media (Cloudinary). */
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_MAX_BYTES = 10 * 1024 * 1024;

/** Upload a single image via the media intent flow and return its asset. */
export async function uploadImageAsset(file: File): Promise<MediaAsset> {
  const intent = await contentApi.createUploadIntent(file.type, file.size);
  await uploadToProvider(intent, file);
  return contentApi.completeUpload(intent.id);
}
