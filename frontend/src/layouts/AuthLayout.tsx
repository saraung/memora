import { Outlet } from "react-router-dom";

const HIGHLIGHTS = [
  "Moments, stories and memories in one place",
  "Private by default, with granular controls",
  "Real-time conversations that stay yours",
] as const;

/** Split-panel layout for unauthenticated screens: brand gradient + form. */
export function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-ink-950 lg:block">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-memora-900 via-ink-950 to-black"
        />
        <div
          aria-hidden
          className="absolute -top-32 -right-24 size-96 rounded-full bg-memora-500/45 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-peach-400/30 blur-3xl"
        />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="w-fit rounded-2xl bg-white p-3 shadow-lg">
            <img
              src="/brand/memora-logo.png"
              alt="Memora logo"
              draggable={false}
              className="size-12 select-none"
            />
          </div>
          <div>
            <h1 className="font-display max-w-md text-4xl leading-tight font-extrabold tracking-tight text-white">
              Keep every moment,{" "}
              <span className="text-gradient-brand">beautifully</span>.
            </h1>
            <ul className="mt-8 space-y-4">
              {HIGHLIGHTS.map((line) => (
                <li key={line} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white"
                  >
                    ✓
                  </span>
                  <span className="text-[15px] font-medium text-white/85">
                    {line}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-sm text-white/50">
            A modern social platform, private by design.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex min-h-screen items-center justify-center bg-app px-4 py-10 sm:px-8">
        <div className="w-full max-w-md animate-rise">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img
              src="/brand/memora-icon.png"
              alt="Memora logo"
              draggable={false}
              className="size-10 select-none rounded-xl"
            />
            <span className="font-display text-xl font-extrabold tracking-tight text-gradient-brand">
              Memora
            </span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
