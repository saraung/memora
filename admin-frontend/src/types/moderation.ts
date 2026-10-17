/** Moderation domain types (reports + decisions). */

export type ReportCategory =
  | "spam"
  | "harassment"
  | "hate"
  | "nudity"
  | "violence"
  | "misinformation"
  | "self_harm"
  | "copyright"
  | "other";

export type ReportStatus =
  | "pending"
  | "under_review"
  | "action_taken"
  | "dismissed";

export type ModerationDecision =
  | "dismiss"
  | "remove_content"
  | "warn"
  | "restrict"
  | "suspend"
  | "unsuspend";

export type ReportTargetType =
  | "user"
  | "post"
  | "comment"
  | "story"
  | "reel"
  | "message";

export interface UserSummary {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  last_seen_at: string | null;
}

export interface Report {
  id: string;
  reporter: UserSummary | null;
  target_type: ReportTargetType;
  target_id: string;
  category: ReportCategory;
  details: string | null;
  status: ReportStatus;
  assignee: UserSummary | null;
  created_at: string;
  updated_at: string;
}

export interface ModerationAction {
  id: string;
  moderator_id: string | null;
  target_type: string;
  target_id: string;
  decision: ModerationDecision;
  reason: string;
  created_at: string;
}

export interface ReportDetail extends Report {
  actions: ModerationAction[];
}

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  spam: "Spam",
  harassment: "Harassment",
  hate: "Hate speech",
  nudity: "Nudity",
  violence: "Violence",
  misinformation: "Misinformation",
  self_harm: "Self-harm",
  copyright: "Copyright",
  other: "Other",
};

export const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "Pending",
  under_review: "Under review",
  action_taken: "Action taken",
  dismissed: "Dismissed",
};

export const DECISION_LABELS: Record<ModerationDecision, string> = {
  dismiss: "Dismiss report",
  remove_content: "Remove content",
  warn: "Warn author",
  restrict: "Restrict account (7 days)",
  suspend: "Suspend account",
  unsuspend: "Restore account",
};
