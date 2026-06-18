import type { UiTheme } from "./settings-model.js";

export type ResolvedTheme = "light" | "dark";

/**
 * Source of the OS light/dark preference. The default is backed by the
 * `prefers-color-scheme` media query, but a native host (e.g. the Wails desktop app on Linux,
 * where WebKitGTK does not expose the system scheme to the webview) can replace it via
 * {@link setSystemThemeSource}.
 */
export interface SystemThemeSource {
  /** Current OS preference. */
  get(): ResolvedTheme;
  /** Subscribe to OS preference changes. Returns an unsubscribe function. */
  subscribe(listener: (theme: ResolvedTheme) => void): () => void;
}

const PREFERS_DARK = "(prefers-color-scheme: dark)";

function matchMediaSupported(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/** Default source backed by the `prefers-color-scheme` media query. */
function createMatchMediaSource(): SystemThemeSource {
  return {
    get() {
      if (!matchMediaSupported()) return "light";
      return window.matchMedia(PREFERS_DARK).matches ? "dark" : "light";
    },
    subscribe(listener) {
      if (!matchMediaSupported()) return () => {};
      const media = window.matchMedia(PREFERS_DARK);
      const onChange = () => listener(media.matches ? "dark" : "light");
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
  };
}

let activeSource: SystemThemeSource = createMatchMediaSource();

/**
 * Replace the source used to read the OS light/dark preference. Intended for native hosts that
 * can report the system scheme reliably; browser/Storybook builds keep the media-query default.
 */
export function setSystemThemeSource(source: SystemThemeSource): void {
  activeSource = source;
}

/** Read the OS light/dark preference (defaults to light when unavailable). */
export function getSystemTheme(): ResolvedTheme {
  return activeSource.get();
}

/** Subscribe to OS light/dark preference changes. Returns an unsubscribe function. */
export function subscribeSystemTheme(listener: (theme: ResolvedTheme) => void): () => void {
  return activeSource.subscribe(listener);
}

/** Map a stored theme preference to the effective light/dark appearance. */
export function resolveUiTheme(theme: UiTheme, systemTheme: ResolvedTheme = getSystemTheme()): ResolvedTheme {
  if (theme === "system") return systemTheme;
  return theme;
}
