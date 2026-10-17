/** Categorical palette shared by the dashboard charts. */

export const BRAND = "#d41e45";
export const BRAND_DARK = "#b3153a";

/** Ordered categorical colors (brand first). Readable on light + dark. */
export const CHART_COLORS = [
  "#d41e45",
  "#f59e0b",
  "#0ea5e9",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
] as const;

export const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  under_review: "#0ea5e9",
  action_taken: "#10b981",
  dismissed: "#94a3b8",
};

export function colorAt(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
