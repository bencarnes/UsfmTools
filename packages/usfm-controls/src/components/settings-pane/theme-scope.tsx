import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_APPLICATION_SETTINGS, type UiTheme } from "./settings-model.js";
import { getSystemTheme, resolveUiTheme, type ResolvedTheme } from "./theme-utils.js";

const SettingsThemeContext = createContext<UiTheme>(DEFAULT_APPLICATION_SETTINGS.theme);

export interface ThemeScopeProps {
  /** Theme preference; when omitted, reads from the nearest settings theme context. */
  readonly theme?: UiTheme;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Applies the resolved light/dark theme as a `dark` class (for Tailwind) and `data-theme`
 * attribute on a wrapper element. Listens to OS changes when preference is `system`.
 */
export function ThemeScope({ theme: themeProp, children, className }: ThemeScopeProps) {
  const contextTheme = useContext(SettingsThemeContext);
  const preference = themeProp ?? contextTheme;
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  useEffect(() => {
    if (preference !== "system") return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(media.matches ? "dark" : "light");
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const resolved = useMemo(
    () => resolveUiTheme(preference, systemTheme),
    [preference, systemTheme],
  );

  const rootClass = [resolved === "dark" ? "dark" : "", className].filter(Boolean).join(" ");

  return (
    <div className={rootClass || undefined} data-theme={resolved} data-testid="theme-scope">
      {children}
    </div>
  );
}

/** Effective light/dark theme for the current preference (and OS when `system`). */
export function useResolvedTheme(explicit?: UiTheme): ResolvedTheme {
  const contextTheme = useContext(SettingsThemeContext);
  const preference = explicit ?? contextTheme;
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  useEffect(() => {
    if (preference !== "system") return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemTheme(media.matches ? "dark" : "light");
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  return useMemo(() => resolveUiTheme(preference, systemTheme), [preference, systemTheme]);
}

/** @internal Supplies the active theme preference to nested {@link ThemeScope} instances. */
export function SettingsThemePreferenceProvider({
  theme,
  children,
}: {
  readonly theme: UiTheme;
  readonly children: ReactNode;
}) {
  return <SettingsThemeContext.Provider value={theme}>{children}</SettingsThemeContext.Provider>;
}
