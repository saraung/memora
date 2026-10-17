/** Moderation types for member-facing reporting (PRD FR-13). */

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

export type ReportTargetType = "user" | "post" | "reel";

export interface ReportCategoryOption {
  value: ReportCategory;
  label: string;
}

export const REPORT_CATEGORIES: ReportCategoryOption[] = [
  { value: "spam", label: "Spam or misleading" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate speech" },
  { value: "nudity", label: "Nudity or sexual content" },
  { value: "violence", label: "Violence or dangerous acts" },
  { value: "misinformation", label: "False information" },
  { value: "self_harm", label: "Suicide or self-harm" },
  { value: "copyright", label: "Intellectual property" },
  { value: "other", label: "Something else" },
];

export interface ReportTarget {
  type: ReportTargetType;
  id: string;
  /** Optional label for the dialog heading (e.g. "@username"). */
  label?: string;
}
