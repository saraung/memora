import type { Paginated } from "@/types/api";
import type { UserSummary } from "@/types/social";

export interface ChatMedia {
  id: string;
  resource_type: string;
  width: number | null;
  height: number | null;
  secure_url: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
}

export interface MessageItem {
  message: ChatMessage;
  sender: UserSummary;
  read_count: number;
  media: ChatMedia[];
}

export type MessagePage = Paginated<MessageItem>;

export interface ConversationPreview {
  id: string;
  other_user: UserSummary;
  last_message: ChatMessage | null;
  unread_count: number;
}

export type ConversationPage = Paginated<ConversationPreview>;

export interface NotificationItem {
  id: string;
  type: string;
  actor: UserSummary | null;
  target_type: string | null;
  target_id: string | null;
  is_read: boolean;
  created_at: string;
}

export type NotificationPage = Paginated<NotificationItem>;
