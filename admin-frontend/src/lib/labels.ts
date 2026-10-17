/** Human-facing labels for backend codes (actions, roles, target types). */

const ACTION_LABELS: Record<string, string> = {
  "moderation.decide": "Moderation decision",
  "admin.account_status": "Account status changed",
  "admin.role_grant": "Role granted",
  "admin.role_revoke": "Role revoked",
};

const TARGET_LABELS: Record<string, string> = {
  user: "Account",
  post: "Post",
  comment: "Comment",
  story: "Story",
  reel: "Moment",
  message: "Message",
  report: "Report",
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  moderator: "Moderator",
  support: "Support agent",
};

const CATEGORY_LABELS_FALLBACK: Record<string, string> = {
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

const STATUS_LABELS_FALLBACK: Record<string, string> = {
  pending: "Pending",
  under_review: "Under review",
  action_taken: "Action taken",
  dismissed: "Dismissed",
};

function titleCase(value: string): string {
  return value
    .replace(/[._]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? titleCase(action);
}

export function targetLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return TARGET_LABELS[type] ?? titleCase(type);
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? titleCase(role);
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS_FALLBACK[category] ?? titleCase(category);
}

export function reportStatusLabel(status: string): string {
  return STATUS_LABELS_FALLBACK[status] ?? titleCase(status);
}

/** Short, single-line summary of an audit event's metadata. */
export function metaSummary(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  const keys = Object.keys(meta);
  if (keys.length === 0) return "";
  return keys
    .slice(0, 3)
    .map((key) => `${key}: ${String(meta[key])}`)
    .join(" · ");
}
