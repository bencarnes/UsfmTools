import type { UiTheme } from "./settings-model.js";

export type ResolvedTheme = "light" | "dark";

/** Read the OS light/dark preference (defaults to light when unavailable). */
export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Map a stored theme preference to the effective light/dark appearance. */
export function resolveUiTheme(theme: UiTheme, systemTheme: ResolvedTheme = getSystemTheme()): ResolvedTheme {
  if (theme === "system") return systemTheme;
  return theme;
}
