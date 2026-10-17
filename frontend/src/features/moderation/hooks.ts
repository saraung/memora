import { useMutation } from "@tanstack/react-query";
import { moderationApi } from "@/services/endpoints/moderation";
import type { SubmitReportPayload } from "@/services/endpoints/moderation";

export function useSubmitReport() {
  return useMutation({
    mutationFn: (payload: SubmitReportPayload) =>
      moderationApi.submitReport(payload),
  });
}
