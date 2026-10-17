import type { ReactNode } from "react";
import { LogoMark } from "@/components/navigation/Logo";

/** Centered card shell for the staff sign-in screen. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-app px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <LogoMark className="size-12" />
          <h1 className="text-lg font-display font-extrabold text-1">
            Memora Admin
          </h1>
          <p className="text-sm text-2">Staff operations console</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
          {children}
        </div>
      </div>
    </div>
  );
}
