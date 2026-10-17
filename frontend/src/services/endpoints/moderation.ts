import { api } from "@/services/api-client";
import type { ReportCategory, ReportTargetType } from "@/types/moderation";

export interface SubmitReportPayload {
  target_type: ReportTargetType;
  target_id: string;
  category: ReportCategory;
  details?: string | null;
}

export interface ReportSubmission {
  id: string;
}

export const moderationApi = {
  async submitReport(payload: SubmitReportPayload): Promise<ReportSubmission> {
    const { data } = await api.post<ReportSubmission>("/reports", payload);
    return data;
  },
};
