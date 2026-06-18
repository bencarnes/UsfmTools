import { setSystemThemeSource, type ResolvedTheme } from "@usfm-tools/controls";
import { GetSystemTheme } from "../wailsjs/go/main/App.js";

const PREFERS_DARK = "(prefers-color-scheme: dark)";

function mediaQueryTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia(PREFERS_DARK).matches ? "dark" : "light";
}

/**
 * Routes the shared theme resolver through the Go backend so "System" follows the real OS setting.
 *
 * WebKitGTK (the Wails webview on Linux) does not expose the system `prefers-color-scheme` to the
 * page, so `matchMedia` always reports light there. The backend detects the OS preference instead;
 * when it cannot (or on platforms where the media query works), we fall back to `matchMedia`.
 */
export async function installNativeSystemTheme(): Promise<void> {
  let backendTheme: ResolvedTheme | null = null;
  const listeners = new Set<(theme: ResolvedTheme) => void>();

  const current = (): ResolvedTheme => backendTheme ?? mediaQueryTheme();

  const refresh = async () => {
    const previous = current();
    try {
      const value = await GetSystemTheme();
      backendTheme = value === "dark" ? "dark" : value === "light" ? "light" : null;
    } catch {
      backendTheme = null;
    }
    const next = current();
    if (next !== previous) listeners.forEach((listener) => listener(next));
  };

  await refresh();

  setSystemThemeSource({
    get: current,
    subscribe(listener) {
      listeners.add(listener);
      // Re-query the backend whenever the webview reports a media change; some environments do
      // fire it, and it is a cheap way to follow live OS theme switches.
      const media =
        typeof window !== "undefined" && typeof window.matchMedia === "function"
          ? window.matchMedia(PREFERS_DARK)
          : null;
      const onMediaChange = () => void refresh();
      media?.addEventListener("change", onMediaChange);
      return () => {
        listeners.delete(listener);
        media?.removeEventListener("change", onMediaChange);
      };
    },
  });
}
