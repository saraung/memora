import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { ToastProvider } from "@/components/ui/Toast";
import { ReportProvider } from "@/components/moderation/ReportDialog";
import { useRealtimeConnection } from "@/features/chat/hooks";
import { AuthProvider } from "@/hooks/useAuth";
import { queryClient } from "@/lib/query-client";
import { router } from "@/app/router";

function RealtimeRunner() {
  useRealtimeConnection();
  return null;
}

export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RealtimeRunner />
        <ToastProvider>
          <ReportProvider>
            <RouterProvider router={router} />
          </ReportProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
