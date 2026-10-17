/** Theme state: light/dark, persisted per device. Light is the default. */

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "memora-theme";

const listeners = new Set<(theme: Theme) => void>();

function resolveInitial(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    /* storage unavailable */
  }
  return "light";
}

function applyToDom(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

let current: Theme = resolveInitial();
applyToDom(current);

/** Apply the stored theme as early as possible (main.tsx). */
export function initTheme() {
  applyToDom(current);
}

export function useTheme() {
  const [theme, setTheme] = useState(current);

  useEffect(() => {
    listeners.add(setTheme);
    setTheme(current);
    return () => {
      listeners.delete(setTheme);
    };
  }, []);

  const set = useCallback((next: Theme) => {
    current = next;
    applyToDom(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
    for (const listener of listeners) listener(next);
  }, []);

  const toggle = useCallback(
    () => set(current === "dark" ? "light" : "dark"),
    [set]
  );

  return { theme, set, toggle } as const;
}
