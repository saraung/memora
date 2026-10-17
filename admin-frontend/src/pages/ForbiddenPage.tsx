import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/features/auth/useAuth";

export function ForbiddenPage() {
  const { logout, isStaff } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-app px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-500/10">
        <ShieldAlert className="size-7 text-red-500 dark:text-red-400" aria-hidden />
      </span>
      <h1 className="text-xl font-display font-extrabold text-1">
        Access denied
      </h1>
      <p className="max-w-sm text-sm text-2">
        {isStaff
          ? "Your account does not have permission to view this page."
          : "This console is for authorized staff. Your account does not have staff access."}
      </p>
      <Button variant="outline" className="mt-2" onClick={() => void logout()}>
        Sign out
      </Button>
    </div>
  );
}
